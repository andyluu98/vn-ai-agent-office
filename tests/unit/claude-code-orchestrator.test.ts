// tests/unit/claude-code-orchestrator.test.ts
// TDD tests for server/claude-code-adapter/orchestrator.js
import { describe, it, expect } from "vitest";

// CJS interop
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mod = require("../../server/claude-code-adapter/orchestrator");
const { buildDecomposePrompt, parseTaskList, decomposeGoal } = mod;

// ---------------------------------------------------------------------------
// buildDecomposePrompt
// ---------------------------------------------------------------------------

describe("buildDecomposePrompt", () => {
  it("includes the goal text", () => {
    const prompt = buildDecomposePrompt("Build a landing page", ["Coder", "Researcher"]);
    expect(prompt).toContain("Build a landing page");
  });

  it("includes all provided roles", () => {
    const roles = ["Coder", "Researcher", "Orchestrator"];
    const prompt = buildDecomposePrompt("some goal", roles);
    for (const role of roles) {
      expect(prompt).toContain(role);
    }
  });

  it("instructs Claude to return a JSON array", () => {
    const prompt = buildDecomposePrompt("goal", ["Coder"]);
    expect(prompt.toLowerCase()).toMatch(/json/);
    expect(prompt).toContain("[");
  });

  it("instructs Claude to use title, description, role fields", () => {
    const prompt = buildDecomposePrompt("goal", ["Coder"]);
    expect(prompt).toContain("title");
    expect(prompt).toContain("description");
    expect(prompt).toContain("role");
  });
});

// ---------------------------------------------------------------------------
// parseTaskList
// ---------------------------------------------------------------------------

describe("parseTaskList", () => {
  it("parses a clean JSON array", () => {
    const text = JSON.stringify([
      { title: "Write tests", description: "Write unit tests", role: "Coder" },
      { title: "Review code", description: "Review PR", role: "Orchestrator" },
    ]);
    const result = parseTaskList(text);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Write tests");
    expect(result[1].role).toBe("Orchestrator");
  });

  it("extracts JSON array from prose around it", () => {
    const text = `Here are the tasks:\n[\n{"title":"Task A","description":"Do A","role":"Coder"}\n]\nThat's it.`;
    const result = parseTaskList(text);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Task A");
  });

  it("handles multi-line JSON array", () => {
    const text = `Sure, here you go:\n[\n  {\n    "title": "Research",\n    "description": "Find info",\n    "role": "Researcher"\n  },\n  {\n    "title": "Code it",\n    "description": "Implement",\n    "role": "Coder"\n  }\n]\nDone.`;
    const result = parseTaskList(text);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Research");
    expect(result[1].title).toBe("Code it");
  });

  it("drops items without a title", () => {
    const text = JSON.stringify([
      { title: "Good task", description: "ok", role: "Coder" },
      { description: "no title here", role: "Coder" },
      { title: "", description: "empty title", role: "Coder" },
    ]);
    const result = parseTaskList(text);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Good task");
  });

  it("caps to maxTasks (default 8)", () => {
    const items = Array.from({ length: 12 }, (_, i) => ({
      title: `Task ${i}`,
      description: "desc",
      role: "Coder",
    }));
    const text = JSON.stringify(items);
    const result = parseTaskList(text);
    expect(result).toHaveLength(8);
  });

  it("respects custom maxTasks param", () => {
    const items = Array.from({ length: 6 }, (_, i) => ({
      title: `Task ${i}`,
      description: "desc",
      role: "Coder",
    }));
    const text = JSON.stringify(items);
    const result = parseTaskList(text, 3);
    expect(result).toHaveLength(3);
  });

  it("returns empty array when no JSON array found", () => {
    const result = parseTaskList("No array here, just plain text.");
    expect(result).toEqual([]);
  });

  it("returns empty array on malformed JSON", () => {
    const result = parseTaskList("[{bad json here}]");
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// decomposeGoal
// ---------------------------------------------------------------------------

describe("decomposeGoal", () => {
  const ROLES = ["Orchestrator", "Coder", "Researcher"];

  it("returns parsed task list from runner output", async () => {
    const tasks = [
      { title: "Task 1", description: "desc 1", role: "Coder" },
      { title: "Task 2", description: "desc 2", role: "Researcher" },
    ];
    const stubRunner = async () => ({
      text: JSON.stringify(tasks),
      isError: false,
    });
    const result = await decomposeGoal({
      goal: "Build something",
      roles: ROLES,
      runner: stubRunner,
      model: "test-model",
    });
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Task 1");
  });

  it("handles runner output with prose around JSON array", async () => {
    const stubRunner = async () => ({
      text: `I've decomposed the goal:\n[\n{"title":"T1","description":"d1","role":"Coder"}\n]\nHope that helps!`,
      isError: false,
    });
    const result = await decomposeGoal({
      goal: "some goal",
      roles: ROLES,
      runner: stubRunner,
      model: "test-model",
    });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("T1");
  });

  it("handles multi-line JSON from runner", async () => {
    const stubRunner = async () => ({
      text: `[\n  {\n    "title": "MultiLine",\n    "description": "Works across lines",\n    "role": "Researcher"\n  }\n]`,
      isError: false,
    });
    const result = await decomposeGoal({
      goal: "some goal",
      roles: ROLES,
      runner: stubRunner,
      model: "test-model",
    });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("MultiLine");
  });

  it("caps task list to maxTasks", async () => {
    const tasks = Array.from({ length: 10 }, (_, i) => ({
      title: `T${i}`,
      description: "d",
      role: "Coder",
    }));
    const stubRunner = async () => ({ text: JSON.stringify(tasks), isError: false });
    const result = await decomposeGoal({
      goal: "big goal",
      roles: ROLES,
      runner: stubRunner,
      model: "test-model",
      maxTasks: 4,
    });
    expect(result).toHaveLength(4);
  });

  it("throws when runner returns isError=true", async () => {
    const stubRunner = async () => ({
      text: "weekly limit exceeded",
      isError: true,
    });
    await expect(
      decomposeGoal({ goal: "goal", roles: ROLES, runner: stubRunner, model: "m" })
    ).rejects.toThrow(/weekly limit|error/i);
  });

  it("throws when runner output has no parseable task list", async () => {
    const stubRunner = async () => ({
      text: "I cannot help with that.",
      isError: false,
    });
    await expect(
      decomposeGoal({ goal: "goal", roles: ROLES, runner: stubRunner, model: "m" })
    ).rejects.toThrow();
  });

  it("passes system prompt and model to runner", async () => {
    let capturedArgs: Record<string, unknown> = {};
    const stubRunner = async (args: Record<string, unknown>) => {
      capturedArgs = args;
      return { text: JSON.stringify([{ title: "T", description: "d", role: "Coder" }]), isError: false };
    };
    await decomposeGoal({
      goal: "goal",
      roles: ROLES,
      runner: stubRunner,
      model: "my-model",
    });
    expect(capturedArgs.model).toBe("my-model");
    expect(typeof capturedArgs.system).toBe("string");
    expect(typeof capturedArgs.prompt).toBe("string");
  });
});
