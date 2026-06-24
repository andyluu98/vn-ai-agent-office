// tests/unit/claude-code-discussion.test.ts
// TDD tests for server/claude-code-adapter/discussion.js
import { describe, it, expect } from "vitest";

// CJS interop
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mod = require("../../server/claude-code-adapter/discussion");
const { runDiscussion } = mod;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEED_AGENTS = [
  { id: "orch", name: "Orchestrator", role: "Orchestrator", system: "You are Orchestrator." },
  { id: "coder", name: "Coder", role: "Coder", system: "You are Coder." },
  { id: "researcher", name: "Researcher", role: "Researcher", system: "You are Researcher." },
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

const noSleep = () => Promise.resolve();
const fixedNow = () => 50000;

// Canned runner: returns a line per participant based on role
function makeCannedRunner(responseMap: Record<string, string> = {}) {
  return async ({ system }: { system?: string; prompt?: string; model?: string }) => {
    // Identify which agent is calling by checking system string
    const role = SEED_AGENTS.find((a) => system && system.includes(a.name))?.role ?? "Orchestrator";
    const text = responseMap[role] ?? `${role} nói: đã xem xét và đồng ý.`;
    return { text, isError: false };
  };
}

// ---------------------------------------------------------------------------
// M3.1-a: fewer than 2 participants → return null, no upserts
// ---------------------------------------------------------------------------

describe("runDiscussion — < 2 participants → null", () => {
  it("returns null when participants is empty", async () => {
    const upsert = makeUpsertCapture();
    const result = await runDiscussion({
      goal: "Build app",
      participants: [],
      taskResults: [],
      registry: makeRegistry(),
      runner: makeCannedRunner(),
      model: "m",
      upsert,
      sleep: noSleep,
      now: fixedNow,
    });
    expect(result).toBeNull();
    expect(upsert.calls).toHaveLength(0);
  });

  it("returns null when participants has only 1 entry", async () => {
    const upsert = makeUpsertCapture();
    const result = await runDiscussion({
      goal: "Build app",
      participants: ["Coder"],
      taskResults: [{ id: "t1", status: "done", role: "Coder", title: "Write code", note: "Done." }],
      registry: makeRegistry(),
      runner: makeCannedRunner(),
      model: "m",
      upsert,
      sleep: noSleep,
      now: fixedNow,
    });
    expect(result).toBeNull();
    expect(upsert.calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// M3.1-b: 2 participants + rounds=2 → 4 speaking turns in round-robin order
// ---------------------------------------------------------------------------

describe("runDiscussion — 2 participants, rounds=2, turn order", () => {
  it("produces exactly 4 speaking turns (2 participants × 2 rounds)", async () => {
    const upsert = makeUpsertCapture();
    const turnOrder: string[] = [];

    // Spy runner: record which role was called (identified by system prompt)
    const spyRunner = async ({ system, prompt }: { system?: string; prompt?: string; model?: string }) => {
      if (prompt && prompt.includes("tổng hợp")) {
        // synthesis call — return summary
        return { text: "Tổng hợp: mọi thứ ổn.", isError: false };
      }
      const role = SEED_AGENTS.find((a) => system && system.includes(a.name))?.role;
      if (role) turnOrder.push(role);
      return { text: `${role} nói điều gì đó.`, isError: false };
    };

    const result = await runDiscussion({
      goal: "Lập kế hoạch Q4",
      participants: ["Coder", "Researcher"],
      taskResults: [
        { id: "t1", status: "done", role: "Coder", title: "Viết code", note: "Đã xong." },
        { id: "t2", status: "done", role: "Researcher", title: "Nghiên cứu", note: "Tìm được 5 điểm." },
      ],
      registry: makeRegistry(),
      runner: spyRunner,
      model: "m",
      upsert,
      sleep: noSleep,
      now: fixedNow,
      rounds: 2,
    });

    expect(result).not.toBeNull();
    expect(result!.turns).toBe(4);
    // Round-robin: Coder, Researcher, Coder, Researcher
    expect(turnOrder).toEqual(["Coder", "Researcher", "Coder", "Researcher"]);
  });
});

// ---------------------------------------------------------------------------
// M3.1-c: each participant gets an in_progress meeting card; all end done
// ---------------------------------------------------------------------------

describe("runDiscussion — meeting card lifecycle (in_progress → done)", () => {
  it("creates in_progress meeting cards for each participant", async () => {
    const upsert = makeUpsertCapture();

    await runDiscussion({
      goal: "Review sprint",
      participants: ["Coder", "Researcher"],
      taskResults: [],
      registry: makeRegistry(),
      runner: async ({ prompt }: { system?: string; prompt?: string; model?: string }) => {
        if (prompt && prompt.includes("tổng hợp")) return { text: "Kết luận OK.", isError: false };
        return { text: "ok", isError: false };
      },
      model: "m",
      upsert,
      sleep: noSleep,
      now: fixedNow,
      rounds: 1,
    });

    const inProgressCalls = upsert.calls.filter((c) => c.status === "in_progress");
    const inProgressRoles = inProgressCalls.map((c) => c.assignedAgentId);
    expect(inProgressRoles).toContain("Coder");
    expect(inProgressRoles).toContain("Researcher");
  });

  it("sets all participant meeting cards to done at the end", async () => {
    const upsert = makeUpsertCapture();

    await runDiscussion({
      goal: "Review sprint",
      participants: ["Coder", "Researcher"],
      taskResults: [],
      registry: makeRegistry(),
      runner: async ({ prompt }: { system?: string; prompt?: string; model?: string }) => {
        if (prompt && prompt.includes("tổng hợp")) return { text: "Kết luận.", isError: false };
        return { text: "lượt nói", isError: false };
      },
      model: "m",
      upsert,
      sleep: noSleep,
      now: fixedNow,
      rounds: 1,
    });

    // Get the final upsert per meeting card id — expect done
    // Each participant has a stable meeting card id used across the whole discussion
    const meetingCards = upsert.calls.filter(
      (c) => typeof c.id === "string" && (c.id as string).startsWith("meeting-")
    );
    const finalPerRole: Record<string, string> = {};
    for (const card of meetingCards) {
      finalPerRole[String(card.assignedAgentId)] = String(card.status);
    }
    // After discussion, the last upsert for each role must be "done"
    expect(finalPerRole["Coder"]).toBe("done");
    expect(finalPerRole["Researcher"]).toBe("done");
  });
});

// ---------------------------------------------------------------------------
// M3.1-d: conclusion card with status done + synthesis note
// ---------------------------------------------------------------------------

describe("runDiscussion — conclusion card", () => {
  it("writes a conclusion card with status done and synthesis in notes", async () => {
    const upsert = makeUpsertCapture();

    await runDiscussion({
      goal: "Tuyển dụng Q4",
      participants: ["Coder", "Researcher"],
      taskResults: [],
      registry: makeRegistry(),
      runner: async ({ prompt }: { system?: string; prompt?: string; model?: string }) => {
        if (prompt && prompt.includes("tổng hợp")) return { text: "Kết luận: nên tiến hành.", isError: false };
        return { text: "ý kiến tốt", isError: false };
      },
      model: "m",
      upsert,
      sleep: noSleep,
      now: fixedNow,
      rounds: 1,
    });

    const conclusionCard = upsert.calls.find(
      (c) => typeof c.id === "string" && (c.id as string).startsWith("meeting-conclusion-")
    );
    expect(conclusionCard).toBeDefined();
    expect(conclusionCard!.status).toBe("done");
    // notes should contain synthesis text
    const notes = conclusionCard!.notes as string[];
    expect(Array.isArray(notes)).toBe(true);
    expect(notes.some((n) => n.includes("Kết luận"))).toBe(true);
  });

  it("conclusion card title contains the goal", async () => {
    const upsert = makeUpsertCapture();
    const goal = "Kế hoạch marketing tháng 7";

    await runDiscussion({
      goal,
      participants: ["Coder", "Researcher"],
      taskResults: [],
      registry: makeRegistry(),
      runner: async ({ prompt }: { system?: string; prompt?: string; model?: string }) => {
        if (prompt && prompt.includes("tổng hợp")) return { text: "Synthesis result.", isError: false };
        return { text: "ok", isError: false };
      },
      model: "m",
      upsert,
      sleep: noSleep,
      now: fixedNow,
      rounds: 1,
    });

    const conclusionCard = upsert.calls.find(
      (c) => typeof c.id === "string" && (c.id as string).startsWith("meeting-conclusion-")
    );
    expect(conclusionCard).toBeDefined();
    expect(String(conclusionCard!.title)).toContain("Kết luận cuộc họp");
  });
});

// ---------------------------------------------------------------------------
// M3.1-e: assignedAgentId = role on meeting cards
// ---------------------------------------------------------------------------

describe("runDiscussion — assignedAgentId on cards", () => {
  it("each meeting card has assignedAgentId equal to participant role", async () => {
    const upsert = makeUpsertCapture();

    await runDiscussion({
      goal: "Kiểm tra code",
      participants: ["Coder", "Researcher"],
      taskResults: [],
      registry: makeRegistry(),
      runner: async ({ prompt }: { system?: string; prompt?: string; model?: string }) => {
        if (prompt && prompt.includes("tổng hợp")) return { text: "done", isError: false };
        return { text: "ok", isError: false };
      },
      model: "m",
      upsert,
      sleep: noSleep,
      now: fixedNow,
      rounds: 1,
    });

    const meetingCards = upsert.calls.filter(
      (c) => typeof c.id === "string" && (c.id as string).startsWith("meeting-") &&
             !(c.id as string).startsWith("meeting-conclusion-")
    );
    for (const card of meetingCards) {
      expect(["Coder", "Researcher"]).toContain(card.assignedAgentId);
    }
  });
});

// ---------------------------------------------------------------------------
// M3.1-f: runner isError on a turn does NOT abort discussion
// ---------------------------------------------------------------------------

describe("runDiscussion — error resilience", () => {
  it("continues discussion when one turn runner returns isError", async () => {
    const upsert = makeUpsertCapture();
    let callCount = 0;

    const flakyRunner = async ({ prompt }: { system?: string; prompt?: string; model?: string }) => {
      if (prompt && prompt.includes("tổng hợp")) return { text: "Tổng hợp cuối.", isError: false };
      callCount++;
      // First speaking turn fails, rest succeed
      if (callCount === 1) return { text: "weekly limit exceeded", isError: true };
      return { text: "ý kiến hợp lệ", isError: false };
    };

    const result = await runDiscussion({
      goal: "Test resilience",
      participants: ["Coder", "Researcher"],
      taskResults: [],
      registry: makeRegistry(),
      runner: flakyRunner,
      model: "m",
      upsert,
      sleep: noSleep,
      now: fixedNow,
      rounds: 2,
    });

    // Should still complete (not throw)
    expect(result).not.toBeNull();
    // Should have 4 log entries (one interrupted, 3 ok) — turns count all attempts
    expect(result!.turns).toBe(4);
    // Synthesis should still run
    expect(typeof result!.synthesis).toBe("string");
    expect(result!.synthesis).toContain("Tổng hợp");
  });

  it("continues discussion when one turn runner throws", async () => {
    const upsert = makeUpsertCapture();
    let speakingCallCount = 0;

    const throwingRunner = async ({ prompt }: { system?: string; prompt?: string; model?: string }) => {
      if (prompt && prompt.includes("tổng hợp")) return { text: "OK summary.", isError: false };
      speakingCallCount++;
      if (speakingCallCount === 2) throw new Error("network error");
      return { text: "ok", isError: false };
    };

    const result = await runDiscussion({
      goal: "Test throw resilience",
      participants: ["Coder", "Researcher"],
      taskResults: [],
      registry: makeRegistry(),
      runner: throwingRunner,
      model: "m",
      upsert,
      sleep: noSleep,
      now: fixedNow,
      rounds: 2,
    });

    expect(result).not.toBeNull();
    expect(result!.turns).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// M3.1 — maxParticipants cap
// ---------------------------------------------------------------------------

describe("runDiscussion — maxParticipants cap", () => {
  it("caps participants to maxParticipants", async () => {
    const upsert = makeUpsertCapture();
    const fourAgents = [
      { id: "a1", name: "Alpha", role: "Alpha", system: "You are Alpha." },
      { id: "a2", name: "Beta", role: "Beta", system: "You are Beta." },
      { id: "a3", name: "Gamma", role: "Gamma", system: "You are Gamma." },
      { id: "a4", name: "Delta", role: "Delta", system: "You are Delta." },
    ];
    const bigRegistry = {
      list: () => fourAgents,
      findByRole: (role: string) => fourAgents.find((a) => a.role === role),
    };

    const speakingRoles: string[] = [];
    const spyRunner = async ({ system, prompt }: { system?: string; prompt?: string; model?: string }) => {
      if (prompt && prompt.includes("tổng hợp")) return { text: "OK.", isError: false };
      const role = fourAgents.find((a) => system && system.includes(a.name))?.role;
      if (role) speakingRoles.push(role);
      return { text: "ok", isError: false };
    };

    await runDiscussion({
      goal: "Big meeting",
      participants: ["Alpha", "Beta", "Gamma", "Delta"],
      taskResults: [],
      registry: bigRegistry,
      runner: spyRunner,
      model: "m",
      upsert,
      sleep: noSleep,
      now: fixedNow,
      rounds: 1,
      maxParticipants: 2,
    });

    // Only the first 2 participants should have spoken
    const uniqueSpeakers = [...new Set(speakingRoles)];
    expect(uniqueSpeakers).toHaveLength(2);
    expect(uniqueSpeakers).toEqual(["Alpha", "Beta"]);
  });
});

// ---------------------------------------------------------------------------
// M3.1 — source = claw3d_manual on meeting cards
// ---------------------------------------------------------------------------

describe("runDiscussion — card source", () => {
  it("uses source claw3d_manual on all meeting cards", async () => {
    const upsert = makeUpsertCapture();

    await runDiscussion({
      goal: "Source check",
      participants: ["Coder", "Researcher"],
      taskResults: [],
      registry: makeRegistry(),
      runner: async ({ prompt }: { system?: string; prompt?: string; model?: string }) => {
        if (prompt && prompt.includes("tổng hợp")) return { text: "done", isError: false };
        return { text: "ok", isError: false };
      },
      model: "m",
      upsert,
      sleep: noSleep,
      now: fixedNow,
      rounds: 1,
    });

    for (const card of upsert.calls) {
      expect(card.source).toBe("claw3d_manual");
    }
  });
});
