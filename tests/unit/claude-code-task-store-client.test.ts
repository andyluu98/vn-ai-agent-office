// tests/unit/claude-code-task-store-client.test.ts
// TDD tests for server/claude-code-adapter/task-store-client.js
import { describe, it, expect } from "vitest";

// CJS interop
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mod = require("../../server/claude-code-adapter/task-store-client");
const { upsertTask, listTasks } = mod;

// ---------------------------------------------------------------------------
// Stub fetch factory
// ---------------------------------------------------------------------------
function makeFetch(responseBody: unknown, status = 200) {
  return async (url: string, opts?: RequestInit) => {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => responseBody,
      _url: url,
      _opts: opts,
    } as unknown as Response & { _url: string; _opts: RequestInit | undefined };
  };
}

// Capture fetch call details
type FetchCall = { url: string; opts: RequestInit | undefined };
function capturingFetch(responseBody: unknown, status = 200) {
  const calls: FetchCall[] = [];
  const fn = async (url: string, opts?: RequestInit) => {
    calls.push({ url, opts });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => responseBody,
    } as unknown as Response;
  };
  fn.calls = calls;
  return fn;
}

// ---------------------------------------------------------------------------
// upsertTask
// ---------------------------------------------------------------------------

describe("upsertTask", () => {
  it("PUT to {base}/api/task-store with body {task}", async () => {
    const task = { id: "t1", title: "Do something", status: "todo" };
    const stub = capturingFetch({ task });
    await upsertTask(task, stub);

    expect(stub.calls).toHaveLength(1);
    const call = stub.calls[0];
    expect(call.url).toMatch(/\/api\/task-store$/);
    expect(call.opts?.method).toBe("PUT");
    const body = JSON.parse(call.opts?.body as string);
    expect(body).toEqual({ task });
  });

  it("sends Content-Type: application/json header", async () => {
    const task = { id: "t2", title: "Another task" };
    const stub = capturingFetch({ task });
    await upsertTask(task, stub);

    const headers = stub.calls[0].opts?.headers as Record<string, string>;
    expect(headers?.["Content-Type"]).toBe("application/json");
  });

  it("returns the upserted task from response", async () => {
    const task = { id: "t3", title: "Return me", status: "done" };
    const stub = makeFetch({ task });
    const result = await upsertTask(task, stub);
    expect(result).toEqual(task);
  });

  it("uses OFFICE_STUDIO_URL env or default http://localhost:3000", async () => {
    const task = { id: "t4", title: "Test base URL" };
    const stub = capturingFetch({ task });
    await upsertTask(task, stub);
    // Should use default base URL
    expect(stub.calls[0].url).toContain("localhost:3000");
  });

  it("throws on non-ok response", async () => {
    const task = { id: "t5", title: "Bad" };
    const stub = makeFetch({ error: "not found" }, 404);
    await expect(upsertTask(task, stub)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// listTasks
// ---------------------------------------------------------------------------

describe("listTasks", () => {
  it("GET {base}/api/task-store", async () => {
    const stub = capturingFetch({ tasks: [] });
    await listTasks(stub);

    expect(stub.calls).toHaveLength(1);
    const call = stub.calls[0];
    expect(call.url).toMatch(/\/api\/task-store$/);
    expect(call.opts?.method ?? "GET").toBe("GET");
  });

  it("returns the tasks array from response", async () => {
    const tasks = [
      { id: "t1", title: "Task One", status: "todo" },
      { id: "t2", title: "Task Two", status: "done" },
    ];
    const stub = makeFetch({ tasks });
    const result = await listTasks(stub);
    expect(result).toEqual(tasks);
  });

  it("returns empty array when tasks field is missing", async () => {
    const stub = makeFetch({});
    const result = await listTasks(stub);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("throws on non-ok response", async () => {
    const stub = makeFetch({ error: "server error" }, 500);
    await expect(listTasks(stub)).rejects.toThrow();
  });
});
