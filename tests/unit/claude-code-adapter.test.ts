// tests/unit/claude-code-adapter.test.ts
import { describe, it, expect } from "vitest";
import { handleRequest, buildPrompt } from "../../server/claude-code-adapter/handler";
import { ROSTER } from "../../server/claude-code-adapter/roster";

const MODEL = "claude-haiku-4-5-20251001";
const okRunner = async ({ prompt, system }: { prompt: string; system?: string }) => ({
  text: `echo:${system && system.includes("Coder") ? "coder" : "gen"}:${prompt}`,
  isError: false,
  sessionId: "sess-1",
});

describe("claude-code adapter handler", () => {
  it("GET /health returns ok", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await handleRequest({ method: "GET", pathname: "/health", body: undefined as any, runner: okRunner, roster: ROSTER, model: MODEL });
    expect(r.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((r.body as any).ok).toBe(true);
  });

  it("GET /state exposes one active role per roster entry", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await handleRequest({ method: "GET", pathname: "/state", body: undefined as any, runner: okRunner, roster: ROSTER, model: MODEL });
    expect(r.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = r.body as any;
    expect(Object.keys(body.active)).toEqual(ROSTER.map((x: { role: string }) => x.role));
    expect(body.runtime.name).toBe("Claude Code");
  });

  it("GET /registry lists the model", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await handleRequest({ method: "GET", pathname: "/registry", body: undefined as any, runner: okRunner, roster: ROSTER, model: MODEL });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((r.body as any).models[MODEL]).toBeTruthy();
  });

  it("POST /v1/chat/completions returns assistant text routed by role", async () => {
    const r = await handleRequest({
      method: "POST", pathname: "/v1/chat/completions", runner: okRunner, roster: ROSTER, model: MODEL,
      body: { role: "Coder", messages: [{ role: "user", content: "hi" }] },
    });
    expect(r.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = r.body as any;
    expect(body.choices[0].message.content).toContain("coder");
    expect(body.choices[0].message.content).toContain("hi");
  });

  it("POST with empty messages -> 400", async () => {
    const r = await handleRequest({
      method: "POST", pathname: "/v1/chat/completions", runner: okRunner, roster: ROSTER, model: MODEL,
      body: { messages: [] },
    });
    expect(r.status).toBe(400);
  });

  it("runner throw -> 502", async () => {
    const failRunner = async () => { throw new Error("boom"); };
    const r = await handleRequest({
      method: "POST", pathname: "/v1/chat/completions", runner: failRunner, roster: ROSTER, model: MODEL,
      body: { messages: [{ role: "user", content: "x" }] },
    });
    expect(r.status).toBe(502);
  });

  it("claude is_error -> 502 (e.g. weekly limit)", async () => {
    const limitRunner = async () => ({ text: "weekly limit", isError: true });
    const r = await handleRequest({
      method: "POST", pathname: "/v1/chat/completions", runner: limitRunner, roster: ROSTER, model: MODEL,
      body: { messages: [{ role: "user", content: "x" }] },
    });
    expect(r.status).toBe(502);
  });

  it("buildPrompt formats a transcript", () => {
    expect(buildPrompt([{ role: "user", content: "a" }, { role: "assistant", content: "b" }]))
      .toBe("User: a\n\nAssistant: b");
  });
});
