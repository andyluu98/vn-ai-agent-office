// server/claude-code-runtime-adapter.js
// HTTP entry point for the Claude Code adapter.
// Creates one shared AgentRegistry seeded from the static roster, then passes
// it to the pure handleRequest handler on every request.
const http = require("node:http");
const { handleRequest } = require("./claude-code-adapter/handler");
const { runClaudeCli, checkClaudeAvailable } = require("./claude-code-adapter/claude-runner");
const { ROSTER, DEFAULT_MODEL } = require("./claude-code-adapter/roster");
const { createRegistry } = require("./claude-code-adapter/agent-registry");

const PORT = Number(process.env.CLAUDE_ADAPTER_PORT || 7770);
const HOST = process.env.CLAUDE_ADAPTER_HOST || "127.0.0.1";
const MAX_AGENTS = Number(process.env.CLAUDE_ADAPTER_MAX_AGENTS || 12);
const AGENT_TTL_MS = Number(process.env.CLAUDE_ADAPTER_AGENT_TTL_MS || 1_800_000);

// C-2: Concurrency gate — cap simultaneous in-flight handleRequest calls so that
// the machine is not saturated by many claude child processes at once.
// Default 4; tune via CLAUDE_ADAPTER_MAX_CONCURRENT.
const MAX_CONCURRENT = Number(process.env.CLAUDE_ADAPTER_MAX_CONCURRENT || 4);
let inFlight = 0;

// I-3: Reject request bodies larger than 1 MB to prevent OOM via huge POSTs.
const MAX_BODY_BYTES = 1 * 1024 * 1024;

// One shared mutable registry for the lifetime of this process.
const registry = createRegistry({ seed: ROSTER, maxAgents: MAX_AGENTS, ttlMs: AGENT_TTL_MS });

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const chunks = [];
  let bytesRead = 0;
  let bodyTooLarge = false;

  // I-3: Enforce 1 MB body limit — stop buffering and reject early.
  req.on("data", (c) => {
    bytesRead += c.length;
    if (bytesRead > MAX_BODY_BYTES) {
      bodyTooLarge = true;
      res.writeHead(413, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ error: "Request body too large (max 1 MB)." }));
      req.destroy();
      return;
    }
    chunks.push(c);
  });
  req.on("error", () => res.destroy());
  req.on("end", async () => {
    if (bodyTooLarge) return; // already responded above

    let body;
    if (chunks.length) {
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        body = undefined;
      }
    }

    // C-2: Concurrency gate — reject with 429 when too many claude processes in flight.
    if (inFlight >= MAX_CONCURRENT) {
      res.writeHead(429, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ error: "Too many concurrent requests." }));
      return;
    }

    inFlight++;
    let result;
    try {
      result = await handleRequest({
        method: req.method,
        pathname,
        body,
        runner: runClaudeCli,
        registry,
        model: DEFAULT_MODEL,
      });
    } catch (err) {
      result = { status: 500, body: { error: (err && err.message) || "Adapter error." } };
    } finally {
      inFlight--;
    }
    res.writeHead(result.status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(result.body));
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[claude-code-adapter] listening on http://${HOST}:${PORT} (model: ${DEFAULT_MODEL})`);
  console.log(`[claude-code-adapter] maxAgents: ${MAX_AGENTS}, ttlMs: ${AGENT_TTL_MS}`);
  // Early diagnostic so a misconfigured CLI is obvious at startup, not only on first chat.
  checkClaudeAvailable().then((status) => {
    if (status.ok) {
      console.log(`[claude-code-adapter] claude CLI detected: ${status.version}`);
    } else if (status.error === "not-found") {
      console.warn(
        "[claude-code-adapter] WARNING: 'claude' CLI not found on PATH. Chat will fail until you " +
          "install Claude Code (https://claude.ai/code) and sign in, or set CLAUDE_BIN / ANTHROPIC_API_KEY."
      );
    } else {
      console.warn(`[claude-code-adapter] WARNING: claude CLI check failed: ${status.error}`);
    }
  });
});
