// tests/unit/claude-code-command-route.test.ts
// TDD tests for POST /command route in server/claude-code-adapter/handler.js
import { describe, it, expect } from "vitest";

// CJS interop
// eslint-disable-next-line @typescript-eslint/no-require-imports
const registryMod = require("../../server/claude-code-adapter/agent-registry");
const createRegistry = registryMod.createRegistry;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handleRequest } = require("../../server/claude-code-adapter/handler");

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DEFAULT_ROSTER } = require("../../server/claude-code-adapter/roster");

const MODEL = "claude-haiku-4-5-20251001";

function makeRegistry() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createRegistry({ seed: DEFAULT_ROSTER, maxAgents: 12, ttlMs: 1_800_000 }) as any;
}

const okRunner = async () => ({ text: "done", isError: false });

// Stub decompose: returns a fixed 2-task list
const stubDecompose = async ({ goal }: { goal: string }) => [
  { title: `Task 1 for: ${goal}`, description: "First task", role: "Coder" },
  { title: `Task 2 for: ${goal}`, description: "Second task", role: "Researcher" },
];

// Stub runTasks: immediately resolves with results
const stubRunTasks = async ({ tasks }: { tasks: Array<{ title: string; description: string; role: string }> }) =>
  tasks.map((t, i) => ({ id: `task-${i}`, status: "done" as const, role: t.role }));

// Stub upsert: no-op
const stubUpsert = async (task: Record<string, unknown>) => task;

// ---------------------------------------------------------------------------
// POST /command — validation
// ---------------------------------------------------------------------------

describe("POST /command — validation", () => {
  it("returns 400 when goal is missing", async () => {
    const registry = makeRegistry();
    const r = await handleRequest({
      method: "POST",
      pathname: "/command",
      body: {},
      runner: okRunner,
      registry,
      model: MODEL,
      decompose: stubDecompose,
      runTasksFn: stubRunTasks,
      upsert: stubUpsert,
    });
    expect(r.status).toBe(400);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((r.body as any).error).toMatch(/goal/i);
  });

  it("returns 400 when goal is empty string", async () => {
    const registry = makeRegistry();
    const r = await handleRequest({
      method: "POST",
      pathname: "/command",
      body: { goal: "   " },
      runner: okRunner,
      registry,
      model: MODEL,
      decompose: stubDecompose,
      runTasksFn: stubRunTasks,
      upsert: stubUpsert,
    });
    expect(r.status).toBe(400);
  });

  it("returns 400 when body is null", async () => {
    const registry = makeRegistry();
    const r = await handleRequest({
      method: "POST",
      pathname: "/command",
      body: null,
      runner: okRunner,
      registry,
      model: MODEL,
      decompose: stubDecompose,
      runTasksFn: stubRunTasks,
      upsert: stubUpsert,
    });
    expect(r.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /command — success
// ---------------------------------------------------------------------------

describe("POST /command — success", () => {
  it("returns 200 with created count and task titles", async () => {
    const registry = makeRegistry();
    const r = await handleRequest({
      method: "POST",
      pathname: "/command",
      body: { goal: "Build landing page" },
      runner: okRunner,
      registry,
      model: MODEL,
      decompose: stubDecompose,
      runTasksFn: stubRunTasks,
      upsert: stubUpsert,
    });
    expect(r.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = r.body as any;
    expect(body.created).toBe(2);
    expect(Array.isArray(body.tasks)).toBe(true);
    expect(body.tasks).toHaveLength(2);
    expect(body.tasks[0]).toContain("Build landing page");
  });

  it("calls decompose with goal and registry roles", async () => {
    const registry = makeRegistry();
    let capturedArgs: Record<string, unknown> = {};
    const spyDecompose = async (args: Record<string, unknown>) => {
      capturedArgs = args;
      return [{ title: "T1", description: "d1", role: "Coder" }];
    };

    await handleRequest({
      method: "POST",
      pathname: "/command",
      body: { goal: "My goal" },
      runner: okRunner,
      registry,
      model: MODEL,
      decompose: spyDecompose,
      runTasksFn: stubRunTasks,
      upsert: stubUpsert,
    });

    expect(capturedArgs.goal).toBe("My goal");
    expect(Array.isArray(capturedArgs.roles)).toBe(true);
    const roles = capturedArgs.roles as string[];
    // Should contain roles from registry
    expect(roles.length).toBeGreaterThan(0);
    expect(roles).toContain("Orchestrator");
  });

  it("responds immediately (does not await runTasks completion)", async () => {
    const registry = makeRegistry();
    let runTasksStarted = false;
    let runTasksResolved = false;

    const slowRunTasks = async ({ tasks }: { tasks: unknown[] }) => {
      runTasksStarted = true;
      await new Promise((resolve) => setTimeout(resolve, 50));
      runTasksResolved = true;
      return (tasks as Array<{ role: string }>).map((t, i) => ({
        id: `t-${i}`, status: "done" as const, role: t.role,
      }));
    };

    const r = await handleRequest({
      method: "POST",
      pathname: "/command",
      body: { goal: "Fast response test" },
      runner: okRunner,
      registry,
      model: MODEL,
      decompose: stubDecompose,
      runTasksFn: slowRunTasks,
      upsert: stubUpsert,
    });

    // Handler should return 200 immediately — runTasks fires in background
    expect(r.status).toBe(200);
    expect(runTasksStarted).toBe(true);
    // runTasks should NOT be resolved yet (it takes 50ms)
    expect(runTasksResolved).toBe(false);
  });

  it("returns 500 when decompose throws", async () => {
    const registry = makeRegistry();
    const failDecompose = async () => { throw new Error("Claude decompose failed"); };

    const r = await handleRequest({
      method: "POST",
      pathname: "/command",
      body: { goal: "Some goal" },
      runner: okRunner,
      registry,
      model: MODEL,
      decompose: failDecompose,
      runTasksFn: stubRunTasks,
      upsert: stubUpsert,
    });
    expect(r.status).toBe(500);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((r.body as any).error).toMatch(/decompose|failed/i);
  });

  it("existing routes still work after /command added", async () => {
    const registry = makeRegistry();
    const r = await handleRequest({
      method: "GET",
      pathname: "/health",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body: undefined as any,
      runner: okRunner,
      registry,
      model: MODEL,
    });
    expect(r.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((r.body as any).ok).toBe(true);
  });
});
