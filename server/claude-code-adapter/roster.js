// server/claude-code-adapter/roster.js
// Roster of Claude-driven agents shown as desks in the office.
// Each role key becomes one agent because the office synthesizes agents
// from GET /state.active (key = role -> model).
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_MODEL = process.env.CLAUDE_ADAPTER_MODEL || "claude-haiku-4-5-20251001";

// Lead spawn instruction appended to Orchestrator's system prompt.
// The lead can request new worker agents by emitting a directive line at the
// end of its reply: [[SPAWN: {"role":"Name","system":"description"}]]
const SPAWN_INSTRUCTION =
  ' To create a supporting agent, add a line at the end of your reply: ' +
  '[[SPAWN: {"role":"RoleName","system":"Brief role description."}]] ' +
  '(one directive per agent; max a few at a time).';

const DEFAULT_ROSTER = [
  {
    id: "orchestrator",
    name: "Orchestrator",
    role: "Orchestrator",
    emoji: "🧭",
    seed: true,
    system:
      "You are the Orchestrator agent in a virtual office. Coordinate work, summarize, and delegate. Be concise." +
      SPAWN_INSTRUCTION,
  },
  {
    id: "coder",
    name: "Coder",
    role: "Coder",
    emoji: "💻",
    seed: true,
    system:
      "You are the Coder agent in a virtual office. Write and review code. Be precise and practical.",
  },
  {
    id: "researcher",
    name: "Researcher",
    role: "Researcher",
    emoji: "🔎",
    seed: true,
    system:
      "You are the Researcher agent in a virtual office. Investigate and report findings clearly.",
  },
];

// Load a user-defined roster from claude-agents.json if present; else seed default.
function loadRoster() {
  const file =
    process.env.CLAUDE_ADAPTER_ROSTER || path.join(process.cwd(), "claude-agents.json");
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const list = Array.isArray(raw) ? raw : Array.isArray(raw.agents) ? raw.agents : null;
    if (list && list.length) {
      return list.map((a, i) => ({
        id: a.id || `agent-${i + 1}`,
        name: a.name || a.role || `Agent ${i + 1}`,
        role: a.role || a.name || `Agent${i + 1}`,
        emoji: a.emoji || "🤖",
        seed: true,
        system: a.system || `You are the ${a.name || a.role} agent in a virtual office.`,
      }));
    }
  } catch {
    // no/invalid config -> fall back to default roster
  }
  return DEFAULT_ROSTER;
}

const ROSTER = loadRoster();

function buildRegistryPayload(model) {
  return { models: { [model]: { name: model, provider: "anthropic" } } };
}

module.exports = { ROSTER, DEFAULT_ROSTER, loadRoster, DEFAULT_MODEL, buildRegistryPayload };
