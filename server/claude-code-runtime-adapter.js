// server/claude-code-runtime-adapter.js
const http = require("node:http");
const { handleRequest } = require("./claude-code-adapter/handler");
const { runClaudeCli } = require("./claude-code-adapter/claude-runner");
const { ROSTER, DEFAULT_MODEL } = require("./claude-code-adapter/roster");

const PORT = Number(process.env.CLAUDE_ADAPTER_PORT || 7770);
const HOST = process.env.CLAUDE_ADAPTER_HOST || "127.0.0.1";

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("error", () => res.destroy());
  req.on("end", async () => {
    let body;
    if (chunks.length) {
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        body = undefined;
      }
    }
    let result;
    try {
      result = await handleRequest({
        method: req.method,
        pathname,
        body,
        runner: runClaudeCli,
        roster: ROSTER,
        model: DEFAULT_MODEL,
      });
    } catch (err) {
      result = { status: 500, body: { error: (err && err.message) || "Adapter error." } };
    }
    res.writeHead(result.status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(result.body));
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[claude-code-adapter] listening on http://${HOST}:${PORT} (model: ${DEFAULT_MODEL})`);
});
