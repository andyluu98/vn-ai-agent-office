// server/claude-code-adapter/handler.js
const { buildStatePayload, buildRegistryPayload } = require("./roster");

// Flatten OpenAI-style messages into a plain transcript for `claude -p`.
function buildPrompt(messages) {
  if (!Array.isArray(messages)) return "";
  return messages
    .map((m) => {
      const content =
        typeof m.content === "string"
          ? m.content
          : Array.isArray(m.content)
            ? m.content.map((p) => (p && p.text ? p.text : "")).join("")
            : "";
      const who = m.role === "assistant" ? "Assistant" : "User";
      return `${who}: ${content}`;
    })
    .join("\n\n");
}

async function handleRequest({ method, pathname, body, runner, roster, model }) {
  if (method === "GET" && pathname === "/health") {
    return { status: 200, body: { ok: true, status: "healthy", runtime: "claude-code" } };
  }
  if (method === "GET" && pathname === "/state") {
    return { status: 200, body: buildStatePayload(roster, model) };
  }
  if (method === "GET" && pathname === "/registry") {
    return { status: 200, body: buildRegistryPayload(model) };
  }
  if (method === "POST" && pathname === "/v1/chat/completions") {
    const role = body && (body.role || body.lane);
    const entry = roster.find((r) => r.role === role) || roster[0];
    const prompt = buildPrompt(body && body.messages);
    if (!prompt) return { status: 400, body: { error: "messages[] is required." } };

    let result;
    try {
      result = await runner({
        prompt,
        model: (body && body.model) || model,
        system: entry.system,
        sessionId: body && (body.conversation_id || body.session_id),
      });
    } catch (err) {
      return { status: 502, body: { error: (err && err.message) || "Claude runtime failed." } };
    }
    if (!result || result.isError || !result.text) {
      return {
        status: 502,
        body: { error: (result && result.text) || "Claude runtime returned an empty response." },
      };
    }
    return {
      status: 200,
      body: {
        id: "chatcmpl-" + (result.sessionId || "claude"),
        object: "chat.completion",
        model: (body && body.model) || model,
        choices: [
          { index: 0, message: { role: "assistant", content: result.text }, finish_reason: "stop" },
        ],
      },
    };
  }
  return { status: 404, body: { error: `Not found: ${method} ${pathname}` } };
}

module.exports = { buildPrompt, handleRequest };
