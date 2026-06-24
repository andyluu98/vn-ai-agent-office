// tests/unit/claude-code-adapter.test.ts
import { describe, it, expect } from "vitest";
import { handleRequest, buildPrompt } from "../../server/claude-code-adapter/handler";
// Use the built-in DEFAULT_ROSTER (3 agents) so tests are deterministic and do
// NOT depend on a user-provided claude-agents.json at the repo root.
import { DEFAULT_ROSTER as ROSTER } from "../../server/claude-code-adapter/roster";

// CJS interop for registry
// eslint-disable-next-line @typescript-eslint/no-require-imports
const registryMod = require("../../server/claude-code-adapter/agent-registry");
const createRegistry: (opts: { seed: unknown[]; maxAgents?: number; ttlMs?: number }) => unknown =
  registryMod.default ?? registryMod.createRegistry ?? registryMod;

const MODEL = "claude-haiku-4-5-20251001";

const okRunner = async ({ prompt, system }: { prompt: string; system?: string }) => ({
  text: `echo:${system && system.includes("Coder") ? "coder" : "gen"}:${prompt}`,
  isError: false,
  sessionId: "sess-1",
});

// Build a registry seeded from ROSTER for the original 8 tests (backward compat)
function makeDefaultRegistry() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createRegistry({ seed: ROSTER, maxAgents: 5, ttlMs: 1_800_000 }) as any;
}

describe("claude-code adapter handler", () => {
  it("GET /health returns ok", async () => {
    const registry = makeDefaultRegistry();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await handleRequest({ method: "GET", pathname: "/health", body: undefined as any, runner: okRunner, registry, model: MODEL });
    expect(r.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((r.body as any).ok).toBe(true);
  });

  it("GET /state exposes one active role per roster entry", async () => {
    const registry = makeDefaultRegistry();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await handleRequest({ method: "GET", pathname: "/state", body: undefined as any, runner: okRunner, registry, model: MODEL });
    expect(r.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = r.body as any;
    expect(Object.keys(body.active)).toEqual(ROSTER.map((x: { role: string }) => x.role));
    expect(body.runtime.name).toBe("Claude Code");
  });

  it("GET /registry lists the model", async () => {
    const registry = makeDefaultRegistry();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await handleRequest({ method: "GET", pathname: "/registry", body: undefined as any, runner: okRunner, registry, model: MODEL });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((r.body as any).models[MODEL]).toBeTruthy();
  });

  it("POST /v1/chat/completions returns assistant text routed by role", async () => {
    const registry = makeDefaultRegistry();
    const r = await handleRequest({
      method: "POST", pathname: "/v1/chat/completions", runner: okRunner, registry, model: MODEL,
      body: { role: "Coder", messages: [{ role: "user", content: "hi" }] },
    });
    expect(r.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = r.body as any;
    expect(body.choices[0].message.content).toContain("coder");
    expect(body.choices[0].message.content).toContain("hi");
  });

  it("POST with empty messages -> 400", async () => {
    const registry = makeDefaultRegistry();
    const r = await handleRequest({
      method: "POST", pathname: "/v1/chat/completions", runner: okRunner, registry, model: MODEL,
      body: { messages: [] },
    });
    expect(r.status).toBe(400);
  });

  it("runner throw -> 502", async () => {
    const registry = makeDefaultRegistry();
    const failRunner = async () => { throw new Error("boom"); };
    const r = await handleRequest({
      method: "POST", pathname: "/v1/chat/completions", runner: failRunner, registry, model: MODEL,
      body: { messages: [{ role: "user", content: "x" }] },
    });
    expect(r.status).toBe(502);
  });

  it("claude is_error -> 502 (e.g. weekly limit)", async () => {
    const registry = makeDefaultRegistry();
    const limitRunner = async () => ({ text: "weekly limit", isError: true });
    const r = await handleRequest({
      method: "POST", pathname: "/v1/chat/completions", runner: limitRunner, registry, model: MODEL,
      body: { messages: [{ role: "user", content: "x" }] },
    });
    expect(r.status).toBe(502);
  });

  it("buildPrompt formats a transcript", () => {
    expect(buildPrompt([{ role: "user", content: "a" }, { role: "assistant", content: "b" }]))
      .toBe("User: a\n\nAssistant: b");
  });

  // ── Task 3: new registry-endpoint + spawn tests ──────────────────────────

  it("GET /agents lists seed agents", async () => {
    const registry = makeDefaultRegistry();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await handleRequest({ method: "GET", pathname: "/agents", body: undefined as any, runner: okRunner, registry, model: MODEL });
    expect(r.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = r.body as any;
    expect(Array.isArray(body.agents)).toBe(true);
    expect(body.agents.length).toBeGreaterThanOrEqual(ROSTER.length);
    const roles = body.agents.map((a: { role: string }) => a.role);
    for (const entry of ROSTER) expect(roles).toContain(entry.role);
  });

  it("POST /agents adds an agent; GET /state.active then includes the new role", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registry = createRegistry({ seed: ROSTER, maxAgents: 5, ttlMs: 1_800_000 }) as any;
    const addRes = await handleRequest({
      method: "POST", pathname: "/agents", runner: okRunner, registry, model: MODEL,
      body: { name: "Designer", role: "Designer", emoji: "🎨" },
    });
    expect(addRes.status).toBe(201);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((addRes.body as any).agent.role).toBe("Designer");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stateRes = await handleRequest({ method: "GET", pathname: "/state", body: undefined as any, runner: okRunner, registry, model: MODEL });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((stateRes.body as any).active["Designer"]).toBeTruthy();
  });

  it("POST /agents with missing role -> 400", async () => {
    const registry = makeDefaultRegistry();
    const r = await handleRequest({
      method: "POST", pathname: "/agents", runner: okRunner, registry, model: MODEL,
      body: { name: "NoRole" },
    });
    expect(r.status).toBe(400);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((r.body as any).error).toMatch(/role/);
  });

  it("POST /agents beyond cap -> 409", async () => {
    // seed has 3 entries; cap = 3 → immediate cap
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registry = createRegistry({ seed: ROSTER, maxAgents: 3, ttlMs: 1_800_000 }) as any;
    const r = await handleRequest({
      method: "POST", pathname: "/agents", runner: okRunner, registry, model: MODEL,
      body: { name: "Extra", role: "Extra" },
    });
    expect(r.status).toBe(409);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((r.body as any).error).toMatch(/cap/);
  });

  it("DELETE /agents/:id removes agent; GET /agents no longer lists it", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registry = createRegistry({ seed: ROSTER, maxAgents: 5, ttlMs: 1_800_000 }) as any;
    // Add a runtime agent first
    const addRes = await handleRequest({
      method: "POST", pathname: "/agents", runner: okRunner, registry, model: MODEL,
      body: { name: "TempWorker", role: "TempWorker" },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agentId = (addRes.body as any).agent.id;

    const delRes = await handleRequest({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      method: "DELETE", pathname: `/agents/${agentId}`, body: undefined as any, runner: okRunner, registry, model: MODEL,
    });
    expect(delRes.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((delRes.body as any).removed).toBe(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listRes = await handleRequest({ method: "GET", pathname: "/agents", body: undefined as any, runner: okRunner, registry, model: MODEL });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roles = (listRes.body as any).agents.map((a: { role: string }) => a.role);
    expect(roles).not.toContain("TempWorker");
  });

  it("DELETE /agents/:id on unknown id -> 404", async () => {
    const registry = makeDefaultRegistry();
    const r = await handleRequest({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      method: "DELETE", pathname: "/agents/nonexistent-id", body: undefined as any, runner: okRunner, registry, model: MODEL,
    });
    expect(r.status).toBe(404);
  });

  it("chat with [[SPAWN]] directive: marker stripped, note appended, worker added to registry", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registry = createRegistry({ seed: ROSTER, maxAgents: 5, ttlMs: 1_800_000 }) as any;
    const spawnRunner = async () => ({
      text: `Done.\n[[SPAWN: {"role":"Worker1","system":"You are Worker1."}]]`,
      isError: false,
      sessionId: "s1",
    });
    const r = await handleRequest({
      method: "POST", pathname: "/v1/chat/completions", runner: spawnRunner, registry, model: MODEL,
      body: { messages: [{ role: "user", content: "go" }] },
    });
    expect(r.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: string = (r.body as any).choices[0].message.content;
    // Raw directive must be stripped
    expect(content).not.toContain("[[SPAWN");
    // Spawned-agent note must be present
    expect(content).toContain("Worker1");
    // Registry must now contain Worker1
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roles = registry.list().map((a: any) => a.role);
    expect(roles).toContain("Worker1");
  });

  it("chat spawn that exceeds cap: worker NOT added, note mentions cap; response still 200", async () => {
    // Fill to cap: 3 seeds + 0 room → maxAgents = 3
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registry = createRegistry({ seed: ROSTER, maxAgents: 3, ttlMs: 1_800_000 }) as any;
    const spawnRunner = async () => ({
      text: `Hello.\n[[SPAWN: {"role":"Overflow"}]]`,
      isError: false,
      sessionId: "s2",
    });
    const r = await handleRequest({
      method: "POST", pathname: "/v1/chat/completions", runner: spawnRunner, registry, model: MODEL,
      body: { messages: [{ role: "user", content: "spawn please" }] },
    });
    expect(r.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: string = (r.body as any).choices[0].message.content;
    // Raw directive must be stripped
    expect(content).not.toContain("[[SPAWN");
    // Must mention the cap block
    expect(content.toLowerCase()).toMatch(/cap|giới hạn/);
    // Worker must NOT be in registry
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roles = registry.list().map((a: any) => a.role);
    expect(roles).not.toContain("Overflow");
  });
});

// ── Security hardening tests ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseSpawnDirectives } = require("../../server/claude-code-adapter/spawn-directive");

describe("parseSpawnDirectives (I-1: balanced-brace parser)", () => {
  it("parses a directive whose system contains {placeholder} correctly", () => {
    const text = `Hello.\n[[SPAWN: {"role":"Dev","system":"You handle {tasks} and {issues}."}]]`;
    const { agents, cleanedText } = parseSpawnDirectives(text);
    expect(agents).toHaveLength(1);
    expect(agents[0].role).toBe("Dev");
    expect(agents[0].system).toBe("You handle {tasks} and {issues}.");
    expect(cleanedText).not.toContain("[[SPAWN");
    expect(cleanedText).toContain("Hello.");
  });

  it("parses a multi-line directive (newline inside JSON)", () => {
    const text = `Result.\n[[SPAWN: {\n  "role": "Analyst",\n  "system": "Analyze data."\n}]]`;
    const { agents, cleanedText } = parseSpawnDirectives(text);
    expect(agents).toHaveLength(1);
    expect(agents[0].role).toBe("Analyst");
    expect(cleanedText).not.toContain("[[SPAWN");
  });

  it("parses two directives both correctly", () => {
    const text = `[[SPAWN: {"role":"Alpha","system":"First."}]] done [[SPAWN: {"role":"Beta","system":"Second."}]]`;
    const { agents, cleanedText } = parseSpawnDirectives(text);
    expect(agents).toHaveLength(2);
    expect(agents[0].role).toBe("Alpha");
    expect(agents[1].role).toBe("Beta");
    expect(cleanedText).not.toContain("[[SPAWN");
    expect(cleanedText).toContain("done");
  });

  it("leaves malformed JSON directive as raw text in cleanedText", () => {
    const text = `Oops [[SPAWN: {bad json here}]] end`;
    const { agents, cleanedText } = parseSpawnDirectives(text);
    expect(agents).toHaveLength(0);
    // Malformed directive must remain visible in the text
    expect(cleanedText).toContain("[[SPAWN");
  });
});

describe("agent-registry remove (I-2: seed protection)", () => {
  it("DELETE /agents/:id on a seed agent returns 409; seed still present", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registry = createRegistry({ seed: ROSTER, maxAgents: 5, ttlMs: 1_800_000 }) as any;
    const seedId = ROSTER[0].id || "seed-1";
    const r = await handleRequest({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      method: "DELETE", pathname: `/agents/${seedId}`, body: undefined as any, runner: okRunner, registry, model: MODEL,
    });
    expect(r.status).toBe(409);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((r.body as any).error).toMatch(/seed/i);
    // Seed must still be listed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listRes = await handleRequest({ method: "GET", pathname: "/agents", body: undefined as any, runner: okRunner, registry, model: MODEL });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roles = (listRes.body as any).agents.map((a: any) => a.role);
    expect(roles).toContain(ROSTER[0].role);
  });

  it("DELETE /agents/:id on a spawned (non-seed) agent succeeds", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registry = createRegistry({ seed: ROSTER, maxAgents: 5, ttlMs: 1_800_000 }) as any;
    const addRes = await handleRequest({
      method: "POST", pathname: "/agents", runner: okRunner, registry, model: MODEL,
      body: { name: "Spawned", role: "Spawned" },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agentId = (addRes.body as any).agent.id;
    const delRes = await handleRequest({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      method: "DELETE", pathname: `/agents/${agentId}`, body: undefined as any, runner: okRunner, registry, model: MODEL,
    });
    expect(delRes.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((delRes.body as any).removed).toBe(true);
  });
});
