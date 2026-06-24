import { describe, it, expect } from "vitest";
// CommonJS module; default-import interop under vitest.
import runner from "../../server/claude-code-adapter/claude-runner";

const BOGUS = "claude-nonexistent-xyz123";

describe("claude-runner not-found handling", () => {
  it("checkClaudeAvailable reports not-found for a missing CLI", async () => {
    const status = await runner.checkClaudeAvailable(BOGUS);
    expect(status.ok).toBe(false);
    expect(status.error).toBe("not-found");
  });

  it("runClaudeCli rejects with an actionable install message when CLI is missing", async () => {
    await expect(
      runner.runClaudeCli({ prompt: "hi", model: undefined, system: undefined, claudeBin: BOGUS })
    ).rejects.toThrow(/Install Claude Code|was not found/i);
  });
});
