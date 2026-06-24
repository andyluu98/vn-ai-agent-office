// server/claude-code-adapter/handler.js
// Pure request handler — no I/O side-effects, fully injectable (runner, registry, now).
// Accepts `registry` (AgentRegistry instance from agent-registry.js).
"use strict";

const { buildRegistryPayload } = require("./roster");
const { parseSpawnDirectives } = require("./spawn-directive");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flatten OpenAI-style messages into a plain transcript for `claude -p`. */
function buildPrompt(messages) {
  if (!Array.isArray(messages)) return "";
  return messages
    .map((m) => {
      const content =
        typeof m.content === "string"
          ? m.content
          : Array.isArray(m.content)
            ? m.content.map((p) => (p && p.text ? p.text : "")).join("")
            : "";
      const who = m.role === "assistant" ? "Assistant" : "User";
      return `${who}: ${content}`;
    })
    .join("\n\n");
}

/** Build the /state payload from a live registry list. */
function buildStateFromRegistry(agents, model) {
  const first = agents[0] || { name: "Claude", role: "Orchestrator" };
  const active = {};
  for (const a of agents) active[a.role] = model;
  return {
    identity: { name: first.name, role: first.role, model_id: model },
    runtime: {
      name: "Claude Code",
      version: process.env.CLAUDE_ADAPTER_VERSION || "cli",
      vendor: "Anthropic",
      status: "healthy",
      active_model: model,
    },
    active,
  };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

/**
 * handleRequest — pure, side-effect-free (aside from mutating `registry`).
 *
 * @param {{ method, pathname, body, runner, registry, model, now? }} opts
 *   now – injectable clock fn `() => number`; defaults to `() => Date.now()`
 */
async function handleRequest({ method, pathname, body, runner, registry, model, now: nowFn }) {
  const now = typeof nowFn === "function" ? nowFn() : Date.now();

  // ── Health ────────────────────────────────────────────────────────────────
  if (method === "GET" && pathname === "/health") {
    return { status: 200, body: { ok: true, status: "healthy", runtime: "claude-code" } };
  }

  // ── State (live registry) ─────────────────────────────────────────────────
  if (method === "GET" && pathname === "/state") {
    return { status: 200, body: buildStateFromRegistry(registry.list(), model) };
  }

  // ── Model registry ────────────────────────────────────────────────────────
  if (method === "GET" && pathname === "/registry") {
    return { status: 200, body: buildRegistryPayload(model) };
  }

  // ── Agent list ────────────────────────────────────────────────────────────
  if (method === "GET" && pathname === "/agents") {
    return { status: 200, body: { agents: registry.list() } };
  }

  // ── Add agent ─────────────────────────────────────────────────────────────
  if (method === "POST" && pathname === "/agents") {
    if (!body || !body.role) {
      return { status: 400, body: { error: "body.role is required." } };
    }
    const result = registry.add(
      { id: body.id, name: body.name, role: body.role, system: body.system, emoji: body.emoji },
      now,
    );
    if (!result.ok) {
      return {
        status: 409,
        body: { error: result.reason === "cap" ? "agent cap reached" : `duplicate role: ${body.role}` },
      };
    }
    return { status: 201, body: { agent: result.agent } };
  }

  // ── Remove agent (POST /agents/remove) ───────────────────────────────────
  // Studio proxy only supports GET/POST, so the browser uses this route.
  if (method === "POST" && pathname === "/agents/remove") {
    const id = body && typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return { status: 400, body: { error: "body.id is required." } };
    }
    const result = registry.remove(id);
    if (!result.removed) {
      if (result.reason === "last") {
        return { status: 409, body: { error: "Không thể xoá agent cuối cùng." } };
      }
      return { status: 404, body: { error: "Agent not found." } };
    }
    return { status: 200, body: { removed: true } };
  }

  // ── Remove agent (DELETE /agents/:id) — kept for curl/tests ──────────────
  if (method === "DELETE" && pathname.startsWith("/agents/")) {
    const id = pathname.slice("/agents/".length);
    const result = registry.remove(id);
    if (!result.removed) {
      if (result.reason === "last") {
        return { status: 409, body: { error: "Không thể xoá agent cuối cùng." } };
      }
      return { status: 404, body: { error: `Agent not found: ${id}` } };
    }
    return { status: 200, body: { removed: true } };
  }

  // ── Chat completions ──────────────────────────────────────────────────────
  if (method === "POST" && pathname === "/v1/chat/completions") {
    // 1. Prune idle non-seed agents before routing
    registry.pruneIdle(now);

    const role = body && (body.role || body.lane);
    const agents = registry.list();
    const entry = registry.findByRole(role) || agents[0];

    // Guard: no agents available (all were deleted)
    if (!entry) return { status: 503, body: { error: "No agents available." } };

    // Touch the routed agent so it isn't pruned immediately after active use
    if (entry) registry.touch(entry.role, now);

    const prompt = buildPrompt(body && body.messages);
    if (!prompt) return { status: 400, body: { error: "messages[] is required." } };

    // 2. Call the runner
    let result;
    try {
      result = await runner({
        prompt,
        model: (body && body.model) || model,
        system: entry && entry.system,
        sessionId: body && (body.conversation_id || body.session_id),
      });
    } catch (err) {
      return { status: 502, body: { error: (err && err.message) || "Claude runtime failed." } };
    }
    if (!result || result.isError || !result.text) {
      return {
        status: 502,
        body: { error: (result && result.text) || "Claude runtime returned an empty response." },
      };
    }

    // 3. Parse spawn directives from reply
    const { agents: requested, cleanedText } = parseSpawnDirectives(result.text);

    const created = [];
    const blocked = [];
    for (const spec of requested) {
      if (!spec.role) continue;
      // M-3: Use the same `now` value already captured at handler entry (deterministic,
      // injectable for tests) instead of calling Date.now() directly here.
      const addResult = registry.add(
        { name: spec.name || spec.role, role: spec.role, system: spec.system, emoji: spec.emoji },
        now,
      );
      if (addResult.ok) {
        created.push(spec.role);
      } else {
        blocked.push({ role: spec.role, reason: addResult.reason });
      }
    }

    // 4. Build final content: cleaned text + optional spawn note
    let content = cleanedText;
    if (created.length > 0) {
      content += `\n\n_Đã tạo bàn: ${created.join(", ")}._`;
    }
    if (blocked.length > 0) {
      const capBlocked = blocked.filter((b) => b.reason === "cap").map((b) => b.role);
      const dupBlocked = blocked.filter((b) => b.reason === "dup").map((b) => b.role);
      if (capBlocked.length > 0) {
        content += `\n\n_Không thể tạo thêm agent (đã đạt giới hạn cap): ${capBlocked.join(", ")}._`;
      }
      if (dupBlocked.length > 0) {
        content += `\n\n_Agent đã tồn tại (bỏ qua): ${dupBlocked.join(", ")}._`;
      }
    }

    return {
      status: 200,
      body: {
        id: "chatcmpl-" + (result.sessionId || "claude"),
        object: "chat.completion",
        model: (body && body.model) || model,
        choices: [
          { index: 0, message: { role: "assistant", content }, finish_reason: "stop" },
        ],
      },
    };
  }

  return { status: 404, body: { error: `Not found: ${method} ${pathname}` } };
}

module.exports = { buildPrompt, handleRequest };
