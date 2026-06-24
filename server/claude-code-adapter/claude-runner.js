// server/claude-code-adapter/claude-runner.js
const { execFile } = require("node:child_process");

// On Windows an npm-installed `claude` is a `.cmd` shim that execFile cannot
// spawn without a shell (a native install is a real `.exe`). So on Windows we
// run through cmd.exe. To avoid Node's DEP0190 (args array + shell), the
// Windows path passes a single command STRING and no args array; the non-Windows
// path uses an args array with no shell. The system prompt is folded into stdin,
// so the only interpolated token is the model (sanitized below) and the bin path.
const IS_WIN = process.platform === "win32";
const SAFE_MODEL = /^[A-Za-z0-9._:-]+$/;

const NOT_FOUND_HELP =
  "Claude Code CLI ('claude') was not found. Install Claude Code (https://claude.ai/code) " +
  "and sign in, set CLAUDE_BIN to its full path, or set ANTHROPIC_API_KEY to use the API.";

function resolveBin(claudeBin) {
  return claudeBin || process.env.CLAUDE_BIN || "claude";
}

// Detect "command not found" across platforms: execFile without a shell gives
// ENOENT; a Windows shell (cmd.exe) instead exits non-zero with "is not recognized".
function isNotFound(err, stderr) {
  if (err && err.code === "ENOENT") return true;
  const text = `${stderr || ""} ${(err && err.message) || ""}`;
  return /not recognized|cannot find|command not found|no such file/i.test(text);
}

// Spawn `claude` with the given trailing args, cross-platform + no DEP0190.
function spawnClaude(bin, args, options, cb) {
  if (IS_WIN) {
    // Quote the bin (may be a path with spaces); args here are space-free tokens.
    const cmd = [`"${bin}"`, ...args].join(" ");
    return execFile(cmd, { ...options, shell: true }, cb);
  }
  return execFile(bin, args, options, cb);
}

// Calls the local `claude` CLI in headless mode and parses its JSON result.
// Verified output shape: { type:"result", is_error:bool, result:"<text>", session_id:"..." }
function runClaudeCli({ prompt, model, system, claudeBin }) {
  const bin = resolveBin(claudeBin);
  // Fold role/system instructions into the stdin prompt (not a CLI arg) so argv
  // stays space-free and shell-safe on Windows.
  const fullPrompt = system ? `${system}\n\n---\n\n${prompt}` : prompt;
  const args = ["-p", "--output-format", "json"];
  // Only pass --model when it is a safe token; otherwise let the CLI use its default.
  if (model && SAFE_MODEL.test(model)) args.push("--model", model);

  return new Promise((resolve, reject) => {
    const child = spawnClaude(
      bin,
      args,
      { maxBuffer: 16 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => {
        if (err && !stdout) {
          const msg = isNotFound(err, stderr)
            ? NOT_FOUND_HELP
            : (stderr && stderr.trim()) || err.message;
          reject(new Error(msg));
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
    child.stdin.write(fullPrompt);
    child.stdin.end();
  });
}

// Fast, quota-free probe: `claude --version`. Used at startup to warn early if
// the CLI is missing/unauthenticated rather than failing only on first chat.
function checkClaudeAvailable(claudeBin) {
  const bin = resolveBin(claudeBin);
  return new Promise((resolve) => {
    spawnClaude(bin, ["--version"], { windowsHide: true, timeout: 10000 }, (err, stdout, stderr) => {
      if (err) {
        resolve({ ok: false, error: isNotFound(err, stderr) ? "not-found" : err.message });
      } else {
        resolve({ ok: true, version: String(stdout).trim() });
      }
    });
  });
}

module.exports = { runClaudeCli, checkClaudeAvailable, NOT_FOUND_HELP };
