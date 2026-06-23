// server/claude-code-adapter/claude-runner.js
const { execFile } = require("node:child_process");

// Calls the local `claude` CLI in headless mode and parses its JSON result.
// Verified output shape: { type:"result", is_error:bool, result:"<text>", session_id:"..." }
function runClaudeCli({ prompt, model, system, claudeBin }) {
  const bin = claudeBin || process.env.CLAUDE_BIN || "claude";
  return new Promise((resolve, reject) => {
    const args = ["-p", "--output-format", "json"];
    if (model) args.push("--model", model);
    if (system) args.push("--append-system-prompt", system);

    const child = execFile(
      bin,
      args,
      { maxBuffer: 16 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => {
        if (err && !stdout) {
          reject(new Error((stderr && stderr.trim()) || err.message));
          return;
        }
        try {
          const parsed = JSON.parse(stdout);
          resolve({
            text: typeof parsed.result === "string" ? parsed.result : "",
            isError: Boolean(parsed.is_error),
            sessionId: parsed.session_id,
          });
        } catch {
          reject(new Error("Failed to parse claude output: " + String(stdout).slice(0, 200)));
        }
      }
    );
    child.stdin.on("error", () => {});
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

module.exports = { runClaudeCli };
