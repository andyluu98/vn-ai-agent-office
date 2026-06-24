// tests/unit/claude-code-execution-loop.test.ts
// TDD tests for server/claude-code-adapter/execution-loop.js
import { describe, it, expect } from "vitest";

type TaskResult = { id: string; status: string; role: string };

// CJS interop
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mod = require("../../server/claude-code-adapter/execution-loop");
const { runTasks } = mod;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEED_AGENTS = [
  { id: "orch", name: "Orchestrator", role: "Orchestrator", system: "You are Orchestrator.", seed: true },
  { id: "coder", name: "Coder", role: "Coder", system: "You are Coder.", seed: true },
  { id: "researcher", name: "Researcher", role: "Researcher", system: "You are Researcher.", seed: true },
];

function makeRegistry(agents = SEED_AGENTS) {
  return {
    list: () => agents,
    findByRole: (role: string) => agents.find((a) => a.role === role),
  };
}

type UpsertCall = Record<string, unknown>;

function makeUpsertCapture() {
  const calls: UpsertCall[] = [];
  const upsert = async (task: UpsertCall) => {
    calls.push({ ...task });
    return task;
  };
  upsert.calls = calls;
  return upsert;
}

// ---------------------------------------------------------------------------
// Status transition: todo → in_progress → done (success path)
// ---------------------------------------------------------------------------

describe("runTasks — happy path (todo → in_progress → done)", () => {
  it("calls upsert three times per task with correct status sequence", async () => {
    const tasks = [{ title: "Write code", description: "Implement feature X", role: "Coder" }];
    const upsert = makeUpsertCapture();
    const registry = makeRegistry();
    const okRunner = async () => ({ text: "Done!", isError: false });

    await runTasks({ tasks, registry, runner: okRunner, model: "m", upsert, now: () => 1000 });

    // Expect at least 3 upsert calls: todo, in_progress, done
    const statuses = upsert.calls.map((c) => c.status);
    expect(statuses).toContain("todo");
    expect(statuses).toContain("in_progress");
    expect(statuses).toContain("done");

    // Order must be todo → in_progress → done
    const todoIdx = statuses.indexOf("todo");
    const inProgressIdx = statuses.indexOf("in_progress");
    const doneIdx = statuses.indexOf("done");
    expect(todoIdx).toBeLessThan(inProgressIdx);
    expect(inProgressIdx).toBeLessThan(doneIdx);
  });

  it("sets assignedAgentId to the resolved agent role", async () => {
    const tasks = [{ title: "Research X", description: "Find info", role: "Researcher" }];
    const upsert = makeUpsertCapture();
    const registry = makeRegistry();
    const okRunner = async () => ({ text: "Research done", isError: false });

    await runTasks({ tasks, registry, runner: okRunner, model: "m", upsert, now: () => 2000 });

    // All upsert calls should have assignedAgentId = "Researcher"
    for (const call of upsert.calls) {
      expect(call.assignedAgentId).toBe("Researcher");
    }
  });

  it("includes task title and description in final done upsert", async () => {
    const tasks = [{ title: "Deploy app", description: "Deploy to production", role: "Coder" }];
    const upsert = makeUpsertCapture();
    const registry = makeRegistry();
    const okRunner = async () => ({ text: "Deployed!", isError: false });

    await runTasks({ tasks, registry, runner: okRunner, model: "m", upsert, now: () => 3000 });

    const doneCall = upsert.calls.find((c) => c.status === "done");
    expect(doneCall?.title).toBe("Deploy app");
    expect(doneCall?.description).toBe("Deploy to production");
  });

  it("appends runner result text to notes on done", async () => {
    const tasks = [{ title: "Analyze", description: "Analyze data", role: "Researcher" }];
    const upsert = makeUpsertCapture();
    const registry = makeRegistry();
    const okRunner = async () => ({ text: "Analysis complete: found 42 items", isError: false });

    await runTasks({ tasks, registry, runner: okRunner, model: "m", upsert, now: () => 4000 });

    const doneCall = upsert.calls.find((c) => c.status === "done");
    expect(Array.isArray(doneCall?.notes)).toBe(true);
    const notes = doneCall?.notes as string[];
    expect(notes.some((n) => n.includes("Analysis complete"))).toBe(true);
  });

  it("uses source: claw3d_manual on all upserts", async () => {
    const tasks = [{ title: "Task A", description: "desc", role: "Coder" }];
    const upsert = makeUpsertCapture();
    const registry = makeRegistry();
    const okRunner = async () => ({ text: "ok", isError: false });

    await runTasks({ tasks, registry, runner: okRunner, model: "m", upsert, now: () => 5000 });

    for (const call of upsert.calls) {
      expect(call.source).toBe("claw3d_manual");
    }
  });

  it("returns results array with id, status, role per task", async () => {
    const tasks = [
      { title: "T1", description: "d1", role: "Coder" },
      { title: "T2", description: "d2", role: "Researcher" },
    ];
    const upsert = makeUpsertCapture();
    const registry = makeRegistry();
    const okRunner = async () => ({ text: "ok", isError: false });

    const results = (await runTasks({
      tasks, registry, runner: okRunner, model: "m", upsert, now: () => 6000,
    })) as TaskResult[];

    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(typeof r.id).toBe("string");
      expect(r.status).toBe("done");
      expect(typeof r.role).toBe("string");
    }
  });

  it("generates stable unique task ids using now + index", async () => {
    const tasks = [
      { title: "T1", description: "d1", role: "Coder" },
      { title: "T2", description: "d2", role: "Coder" },
    ];
    const upsert = makeUpsertCapture();
    const registry = makeRegistry();
    const okRunner = async () => ({ text: "ok", isError: false });

    const results = (await runTasks({
      tasks, registry, runner: okRunner, model: "m", upsert, now: () => 9999,
    })) as TaskResult[];

    // IDs must be unique
    const ids = results.map((r) => r.id);
    expect(new Set(ids).size).toBe(2);
    // IDs should include the now value
    expect(ids[0]).toContain("9999");
    expect(ids[1]).toContain("9999");
    expect(ids[0]).not.toBe(ids[1]);
  });
});

// ---------------------------------------------------------------------------
// Error path: todo → in_progress → blocked
// ---------------------------------------------------------------------------

describe("runTasks — error path (todo → in_progress → blocked)", () => {
  it("marks task blocked when runner returns isError=true", async () => {
    const tasks = [{ title: "Bad task", description: "will fail", role: "Coder" }];
    const upsert = makeUpsertCapture();
    const registry = makeRegistry();
    const errorRunner = async () => ({ text: "weekly limit exceeded", isError: true });

    await runTasks({ tasks, registry, runner: errorRunner, model: "m", upsert, now: () => 7000 });

    const statuses = upsert.calls.map((c) => c.status);
    expect(statuses).toContain("blocked");
    expect(statuses).not.toContain("done");

    // todo → in_progress → blocked order
    const todoIdx = statuses.indexOf("todo");
    const inProgressIdx = statuses.indexOf("in_progress");
    const blockedIdx = statuses.indexOf("blocked");
    expect(todoIdx).toBeLessThan(inProgressIdx);
    expect(inProgressIdx).toBeLessThan(blockedIdx);
  });

  it("marks task blocked when runner throws", async () => {
    const tasks = [{ title: "Throw task", description: "runner throws", role: "Coder" }];
    const upsert = makeUpsertCapture();
    const registry = makeRegistry();
    const throwRunner = async () => { throw new Error("network error"); };

    await runTasks({ tasks, registry, runner: throwRunner, model: "m", upsert, now: () => 8000 });

    const statuses = upsert.calls.map((c) => c.status);
    expect(statuses).toContain("blocked");
    expect(statuses).not.toContain("done");
  });

  it("includes error message in notes on blocked", async () => {
    const tasks = [{ title: "Fail task", description: "fails", role: "Coder" }];
    const upsert = makeUpsertCapture();
    const registry = makeRegistry();
    const errorRunner = async () => ({ text: "Error: hit weekly limit", isError: true });

    await runTasks({ tasks, registry, runner: errorRunner, model: "m", upsert, now: () => 8500 });

    const blockedCall = upsert.calls.find((c) => c.status === "blocked");
    expect(Array.isArray(blockedCall?.notes)).toBe(true);
    const notes = blockedCall?.notes as string[];
    expect(notes.length).toBeGreaterThan(0);
  });

  it("continues processing subsequent tasks after one fails", async () => {
    const tasks = [
      { title: "Fail", description: "will fail", role: "Coder" },
      { title: "Succeed", description: "will succeed", role: "Researcher" },
    ];
    const upsert = makeUpsertCapture();
    const registry = makeRegistry();
    let callCount = 0;
    const mixedRunner = async () => {
      callCount++;
      if (callCount === 1) return { text: "fail", isError: true };
      return { text: "success", isError: false };
    };

    const results = (await runTasks({
      tasks, registry, runner: mixedRunner, model: "m", upsert, now: () => 9000,
    })) as TaskResult[];

    expect(results[0].status).toBe("blocked");
    expect(results[1].status).toBe("done");
  });
});

// ---------------------------------------------------------------------------
// Agent fallback: unknown role -> first agent in registry
// ---------------------------------------------------------------------------

describe("runTasks — agent resolution", () => {
  it("falls back to first registry agent when role not found", async () => {
    const tasks = [{ title: "Unknown role task", description: "d", role: "UnknownRole" }];
    const upsert = makeUpsertCapture();
    const registry = makeRegistry(); // has Orchestrator, Coder, Researcher
    const okRunner = async () => ({ text: "ok", isError: false });

    await runTasks({ tasks, registry, runner: okRunner, model: "m", upsert, now: () => 11000 });

    // Should assign first agent (Orchestrator) as fallback
    const todoCall = upsert.calls.find((c) => c.status === "todo");
    expect(todoCall?.assignedAgentId).toBe("Orchestrator");
  });

  it("passes agent system prompt to runner", async () => {
    const tasks = [{ title: "Code task", description: "code this", role: "Coder" }];
    const upsert = makeUpsertCapture();
    const registry = makeRegistry();
    let capturedSystem: string | undefined;
    const spyRunner = async ({ system }: { system?: string }) => {
      capturedSystem = system;
      return { text: "done", isError: false };
    };

    await runTasks({ tasks, registry, runner: spyRunner, model: "m", upsert, now: () => 12000 });

    expect(capturedSystem).toContain("Coder");
  });
});
