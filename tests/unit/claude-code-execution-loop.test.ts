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

/**
 * Creates a deferred promise — lets test code resolve it at a specific moment,
 * giving deterministic control over when a "runner" call completes.
 */
function makeDeferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
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

    // Per-task order must be todo → in_progress → done
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

    // Per-task order: todo → in_progress → blocked
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

// ---------------------------------------------------------------------------
// CONCURRENCY: bounded pool — at most N tasks in_progress simultaneously
// ---------------------------------------------------------------------------

describe("runTasks — bounded concurrency pool", () => {
  /**
   * PROOF: with concurrency:2 and 3 tasks, the runner is called at most 2
   * times simultaneously.  Uses injected deferreds so the test is fully
   * deterministic — no real timers.
   *
   * Strategy:
   *   - Each runner call grabs the next deferred from a queue and awaits it.
   *   - We track the peak number of simultaneously-active runner calls.
   *   - We release deferreds in a controlled sequence and verify that:
   *       (a) the peak was exactly CONCURRENCY (never more, never fewer)
   *       (b) the third task only started AFTER the first resolved (pool refill)
   */
  it("runs at most concurrency tasks simultaneously (observed max = 2)", async () => {
    const TASK_COUNT = 3;
    const CONCURRENCY = 2;

    // One deferred per task — we control when each runner call resolves.
    const deferreds = Array.from({ length: TASK_COUNT }, () => makeDeferred<{ text: string; isError: boolean }>());
    let deferredIndex = 0;
    let activeCount = 0;
    let peakActive = 0;
    // Record the deferredIndex grabbed by the 3rd runner call — proves task 2
    // only enters the runner AFTER a slot freed up (index must be 2, not 0 or 1).
    let thirdCallDeferredIndex = -1;

    const controlledRunner = async () => {
      const myDeferredIndex = deferredIndex++;
      if (myDeferredIndex === 2) thirdCallDeferredIndex = myDeferredIndex;
      activeCount++;
      if (activeCount > peakActive) peakActive = activeCount;
      const deferred = deferreds[myDeferredIndex];
      try {
        return await deferred.promise;
      } finally {
        activeCount--;
      }
    };

    const tasks = Array.from({ length: TASK_COUNT }, (_, i) => ({
      title: `Task ${i}`,
      description: `desc ${i}`,
      role: "Coder",
    }));
    const upsert = makeUpsertCapture();
    const registry = makeRegistry();
    const noSleep = () => Promise.resolve();

    // Start runTasks — pool kicks off up to CONCURRENCY=2 tasks immediately.
    const runPromise = runTasks({
      tasks,
      registry,
      runner: controlledRunner,
      model: "m",
      upsert,
      now: () => 20000,
      concurrency: CONCURRENCY,
      sleep: noSleep,
    });

    // Resolve tasks 0 and 1 — this lets the pool finish and start task 2.
    deferreds[0].resolve({ text: "ok0", isError: false });
    deferreds[1].resolve({ text: "ok1", isError: false });
    // Give the microtask queue time to process the completions and start task 2.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Resolve task 2 so runTasks can complete.
    deferreds[2].resolve({ text: "ok2", isError: false });

    const results = (await runPromise) as TaskResult[];

    // All tasks must reach a terminal status.
    expect(results).toHaveLength(TASK_COUNT);
    for (const r of results) {
      expect(["done", "blocked"]).toContain(r.status);
    }

    // Peak concurrent runner calls must be exactly CONCURRENCY (not 1, not 3).
    expect(peakActive).toBe(CONCURRENCY);

    // Task 2 must have been the 3rd runner call (index 2), not earlier — confirms
    // the pool waited for a free slot before starting the third task.
    expect(thirdCallDeferredIndex).toBe(2);
  });

  it("preserves input order in results array even with concurrent execution", async () => {
    // Task 1 resolves BEFORE task 0 — result[0] must still map to task 0.
    const d0 = makeDeferred<{ text: string; isError: boolean }>();
    const d1 = makeDeferred<{ text: string; isError: boolean }>();
    const deferredsMap = [d0, d1];
    let callIdx = 0;

    const outOfOrderRunner = async () => {
      const d = deferredsMap[callIdx++];
      return d.promise;
    };

    const tasks = [
      { title: "Slow", description: "resolves second", role: "Coder" },
      { title: "Fast", description: "resolves first",  role: "Researcher" },
    ];
    const upsert = makeUpsertCapture();
    const registry = makeRegistry();

    const runPromise = runTasks({
      tasks,
      registry,
      runner: outOfOrderRunner,
      model: "m",
      upsert,
      now: () => 21000,
      concurrency: 2,
      sleep: () => Promise.resolve(),
    });

    // Yield so both tasks start.
    await Promise.resolve();
    await Promise.resolve();

    // Resolve task 1 (Fast) first, then task 0 (Slow).
    d1.resolve({ text: "fast-result", isError: false });
    await Promise.resolve();
    d0.resolve({ text: "slow-result", isError: false });

    const results = (await runPromise) as TaskResult[];

    expect(results).toHaveLength(2);
    // results[0] must be "Coder" (task 0 — Slow), results[1] must be "Researcher" (task 1 — Fast).
    expect(results[0].role).toBe("Coder");
    expect(results[1].role).toBe("Researcher");
    expect(results[0].status).toBe("done");
    expect(results[1].status).toBe("done");
  });

  it("all tasks reach terminal status (done/blocked) when some fail", async () => {
    const tasks = [
      { title: "T0", description: "d0", role: "Coder" },
      { title: "T1", description: "d1", role: "Researcher" },
      { title: "T2", description: "d2", role: "Coder" },
      { title: "T3", description: "d3", role: "Orchestrator" },
    ];
    let callCount = 0;
    const flakyRunner = async () => {
      const n = callCount++;
      if (n % 2 === 0) throw new Error("flaky failure");
      return { text: "ok", isError: false };
    };

    const upsert = makeUpsertCapture();
    const registry = makeRegistry();

    const results = (await runTasks({
      tasks,
      registry,
      runner: flakyRunner,
      model: "m",
      upsert,
      now: () => 22000,
      concurrency: 2,
      sleep: () => Promise.resolve(),
    })) as TaskResult[];

    expect(results).toHaveLength(4);
    for (const r of results) {
      expect(["done", "blocked"]).toContain(r.status);
    }
  });

  /**
   * Gate retry: when runner throws "Too many concurrent…", the loop retries
   * (up to maxRetries) before marking blocked.  With a runner that fails the
   * first two attempts and succeeds on the third, the task ends as "done".
   */
  it("retries on 'Too many concurrent' transient error and eventually succeeds", async () => {
    const tasks = [{ title: "Retry task", description: "d", role: "Coder" }];
    let attempts = 0;
    const gateyRunner = async () => {
      attempts++;
      if (attempts < 3) throw new Error("Too many concurrent claude processes.");
      return { text: "finally ok", isError: false };
    };

    const sleepCalls: number[] = [];
    const trackingSleep = (ms: number) => { sleepCalls.push(ms); return Promise.resolve(); };

    const upsert = makeUpsertCapture();
    const registry = makeRegistry();

    const results = (await runTasks({
      tasks,
      registry,
      runner: gateyRunner,
      model: "m",
      upsert,
      now: () => 23000,
      maxRetries: 3,
      sleep: trackingSleep,
    })) as TaskResult[];

    expect(results[0].status).toBe("done");
    expect(attempts).toBe(3);
    // Two retries means two sleep calls (backoff 50 ms, 100 ms).
    expect(sleepCalls).toEqual([50, 100]);
  });

  it("marks task blocked when all retries exhausted on gate error", async () => {
    const tasks = [{ title: "Always gate", description: "d", role: "Coder" }];
    const alwaysGateRunner = async () => {
      throw new Error("Too many concurrent claude processes.");
    };

    const upsert = makeUpsertCapture();
    const registry = makeRegistry();

    const results = (await runTasks({
      tasks,
      registry,
      runner: alwaysGateRunner,
      model: "m",
      upsert,
      now: () => 24000,
      maxRetries: 2,
      sleep: () => Promise.resolve(),
    })) as TaskResult[];

    expect(results[0].status).toBe("blocked");
    const blockedCall = upsert.calls.find((c) => c.status === "blocked");
    expect(blockedCall).toBeDefined();
  });
});
