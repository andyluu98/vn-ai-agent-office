// tests/unit/claude-code-registry.test.ts
import { describe, it, expect } from "vitest";

// CJS interop
// eslint-disable-next-line @typescript-eslint/no-require-imports
const registryMod = require("../../server/claude-code-adapter/agent-registry");
const createRegistry: (opts: { seed: unknown[]; maxAgents?: number; ttlMs?: number; onChange?: (agents: unknown[]) => void }) => unknown =
  registryMod.default ?? registryMod.createRegistry ?? registryMod;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const directiveMod = require("../../server/claude-code-adapter/spawn-directive");
const parseSpawnDirectives: (text: string) => { agents: unknown[]; cleanedText: string } =
  directiveMod.default ?? directiveMod.parseSpawnDirectives ?? directiveMod;

const BASE_SEEDS = [
  { id: "orch", name: "Orchestrator", role: "Orchestrator", emoji: "🧭", system: "You are Orchestrator." },
  { id: "coder", name: "Coder", role: "Coder", emoji: "💻", system: "You are Coder." },
];

describe("AgentRegistry", () => {
  it("seed agents are present, marked seed:true, and returned by list()", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reg = createRegistry({ seed: BASE_SEEDS }) as any;
    const list = reg.list();
    expect(list).toHaveLength(2);
    expect(list[0].role).toBe("Orchestrator");
    expect(list[0].seed).toBe(true);
    expect(list[1].seed).toBe(true);
  });

  it("add() new role succeeds, agent appears in list(), seed:false", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reg = createRegistry({ seed: BASE_SEEDS, maxAgents: 5 }) as any;
    const result = reg.add({ name: "Designer", role: "Designer", emoji: "🎨" }, 1_000_000);
    expect(result.ok).toBe(true);
    expect(result.agent.role).toBe("Designer");
    expect(result.agent.seed).toBe(false);
    const roles = reg.list().map((a: { role: string }) => a.role);
    expect(roles).toContain("Designer");
  });

  it("add() beyond maxAgents returns {ok:false, reason:'cap'} and does NOT add", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reg = createRegistry({ seed: BASE_SEEDS, maxAgents: 2 }) as any;
    const result = reg.add({ name: "Extra", role: "Extra" }, 1_000_000);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("cap");
    expect(reg.list()).toHaveLength(2);
  });

  it("add() duplicate role returns {ok:false, reason:'dup'} and does NOT add", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reg = createRegistry({ seed: BASE_SEEDS, maxAgents: 5 }) as any;
    const result = reg.add({ name: "AnotherCoder", role: "Coder" }, 1_000_000);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("dup");
    expect(reg.list()).toHaveLength(2);
  });

  it("remove(id) removes a spawned agent by id", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reg = createRegistry({ seed: BASE_SEEDS, maxAgents: 5 }) as any;
    const { agent } = reg.add({ name: "Temp", role: "Temp" }, 1_000_000);
    expect(reg.list()).toHaveLength(3);
    const result = reg.remove(agent.id);
    // I-2: remove now returns { removed, reason } instead of a bare boolean
    expect(result.removed).toBe(true);
    expect(reg.list()).toHaveLength(2);
  });

  it("remove() allows deletion of a seed agent when other agents remain", () => {
    // Seed protection removed: any agent can be removed as long as it is not the last.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reg = createRegistry({ seed: BASE_SEEDS, maxAgents: 5 }) as any;
    const result = reg.remove("orch");
    // Two seeds; removing one leaves one behind — must succeed.
    expect(result.removed).toBe(true);
    expect(reg.list()).toHaveLength(1);
  });

  it("remove() allows deletion of the last remaining agent (empty registry is valid)", () => {
    // Last-agent guard removed: registry may become empty after deleting the final agent.
    // An empty registry is handled safely: /state returns empty active map, chat returns 503.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reg = createRegistry({ seed: [BASE_SEEDS[0]], maxAgents: 5 }) as any;
    const result = reg.remove("orch");
    expect(result.removed).toBe(true);
    expect(reg.list()).toHaveLength(0);
  });

  it("remove() all agents leaves empty list, then add() works", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reg = createRegistry({ seed: [BASE_SEEDS[0]], maxAgents: 5 }) as any;
    reg.remove("orch");
    expect(reg.list()).toHaveLength(0);
    const result = reg.add({ name: "Marketing", role: "Marketing" }, 1_000_000);
    expect(result.ok).toBe(true);
    expect(reg.list()).toHaveLength(1);
    expect(reg.list()[0].role).toBe("Marketing");
  });

  it("onChange callback is fired after add()", () => {
    const calls: unknown[][] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reg = createRegistry({ seed: BASE_SEEDS, maxAgents: 5, onChange: (agents: unknown[]) => calls.push(agents) }) as any;
    reg.add({ name: "Designer", role: "Designer" }, 1_000_000);
    expect(calls).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((calls[0] as any[]).some((a: any) => a.role === "Designer")).toBe(true);
  });

  it("onChange callback is fired after remove()", () => {
    const calls: unknown[][] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reg = createRegistry({ seed: BASE_SEEDS, maxAgents: 5, onChange: (agents: unknown[]) => calls.push(agents) }) as any;
    reg.remove("coder");
    expect(calls).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((calls[0] as any[]).some((a: any) => a.role === "Coder")).toBe(false);
  });

  it("onChange is NOT fired when remove() returns notfound", () => {
    const calls: unknown[][] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reg = createRegistry({ seed: BASE_SEEDS, maxAgents: 5, onChange: (agents: unknown[]) => calls.push(agents) }) as any;
    reg.remove("nonexistent-id");
    expect(calls).toHaveLength(0);
  });

  it("pruneIdle removes non-seed agent with expired lastActive, keeps seed", () => {
    const BASE = 1_000_000;
    const TTL = 1_000;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reg = createRegistry({ seed: BASE_SEEDS, maxAgents: 5, ttlMs: TTL }) as any;
    reg.add({ name: "Worker", role: "Worker" }, BASE); // lastActive = BASE
    const expired = BASE + TTL + 1; // past ttl
    const pruned = reg.pruneIdle(expired);
    expect(pruned).toContain("Worker");
    const roles = reg.list().map((a: { role: string }) => a.role);
    // seed preserved
    expect(roles).toContain("Orchestrator");
    expect(roles).toContain("Coder");
    // worker pruned
    expect(roles).not.toContain("Worker");
  });

  it("pruneIdle keeps seed agent even when its lastActive is older than ttl", () => {
    const BASE = 1_000_000;
    const TTL = 1_000;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reg = createRegistry({ seed: BASE_SEEDS, maxAgents: 5, ttlMs: TTL }) as any;
    // seeds start with lastActive=0; now is way past ttl
    const pruned = reg.pruneIdle(BASE + TTL + 1);
    expect(pruned).toHaveLength(0);
    expect(reg.list()).toHaveLength(2);
  });

  it("pruneIdle keeps a fresh spawned agent whose lastActive is within ttl", () => {
    const BASE = 1_000_000;
    const TTL = 1_000;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reg = createRegistry({ seed: BASE_SEEDS, maxAgents: 5, ttlMs: TTL }) as any;
    reg.add({ name: "Fresh", role: "Fresh" }, BASE);
    const notExpired = BASE + TTL - 1; // still within TTL
    const pruned = reg.pruneIdle(notExpired);
    expect(pruned).toHaveLength(0);
    expect(reg.list().map((a: { role: string }) => a.role)).toContain("Fresh");
  });

  it("touch(role, now) updates lastActive so prune keeps the agent", () => {
    const BASE = 1_000_000;
    const TTL = 1_000;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reg = createRegistry({ seed: BASE_SEEDS, maxAgents: 5, ttlMs: TTL }) as any;
    reg.add({ name: "Touched", role: "Touched" }, BASE); // lastActive = BASE
    const midpoint = BASE + TTL + 1; // past original ttl
    reg.touch("Touched", midpoint); // refresh lastActive
    const pruneAt = midpoint + TTL - 1; // within new ttl window
    const pruned = reg.pruneIdle(pruneAt);
    expect(pruned).toHaveLength(0);
    expect(reg.list().map((a: { role: string }) => a.role)).toContain("Touched");
  });

  it("findByRole returns correct agent or undefined", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reg = createRegistry({ seed: BASE_SEEDS }) as any;
    expect(reg.findByRole("Coder").id).toBe("coder");
    expect(reg.findByRole("Nonexistent")).toBeUndefined();
  });
});

describe("parseSpawnDirectives", () => {
  it("no directive -> empty agents, cleanedText equals input", () => {
    const text = "Hello world, no spawning today.";
    const result = parseSpawnDirectives(text);
    expect(result.agents).toHaveLength(0);
    expect(result.cleanedText).toBe(text);
  });

  it("one valid directive -> 1 agent parsed, marker removed from cleanedText", () => {
    const text = `Let me coordinate.\n[[SPAWN: {"role":"Frontend","system":"You are Frontend."}]]\nDone.`;
    const result = parseSpawnDirectives(text);
    expect(result.agents).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.agents[0] as any).role).toBe("Frontend");
    expect(result.cleanedText).not.toContain("[[SPAWN");
    expect(result.cleanedText).toContain("Let me coordinate.");
    expect(result.cleanedText).toContain("Done.");
  });

  it("two valid directives -> 2 agents parsed", () => {
    const text = `Work time.\n[[SPAWN: {"role":"Backend"}]]\n[[SPAWN: {"role":"QA","emoji":"🧪"}]]\nAll set.`;
    const result = parseSpawnDirectives(text);
    expect(result.agents).toHaveLength(2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roles = result.agents.map((a: any) => a.role);
    expect(roles).toContain("Backend");
    expect(roles).toContain("QA");
    expect(result.cleanedText).not.toContain("[[SPAWN");
  });

  it("malformed JSON directive -> 0 agents, text left unchanged", () => {
    const text = `Something [[SPAWN: {not-valid-json}]] here.`;
    const result = parseSpawnDirectives(text);
    expect(result.agents).toHaveLength(0);
    expect(result.cleanedText).toBe(text);
  });

  it("mix of valid and malformed -> only valid parsed; malformed text left", () => {
    const text = `A\n[[SPAWN: {"role":"Worker"}]]\nB [[SPAWN: {bad}]] C`;
    const result = parseSpawnDirectives(text);
    expect(result.agents).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.agents[0] as any).role).toBe("Worker");
    expect(result.cleanedText).not.toContain('[[SPAWN: {"role":"Worker"}]]');
    expect(result.cleanedText).toContain("[[SPAWN: {bad}]]");
  });
});
