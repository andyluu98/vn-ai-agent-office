// server/claude-code-adapter/roster.js
// Roster of Claude-driven agents shown as desks in the office.
// Each role key becomes one agent because the office synthesizes agents
// from GET /state.active (key = role -> model).
const fs = require("node:fs");
const path = require("node:path");
const { loadDepartmentRoster } = require("./department-loader");

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

// Two roster files, by design:
//   RUNTIME file = where live hire/fire is PERSISTED (gitignored, per-machine).
//                  Defaults to claude-agents.local.json (override via CLAUDE_ADAPTER_ROSTER).
//   SEED file    = the committed default roster shipped with the repo (claude-agents.json).
// Precedence on load: RUNTIME (if it exists — even an empty list, so "delete all" sticks)
//                     → else SEED → else built-in DEFAULT_ROSTER.
const RUNTIME_FILE =
  process.env.CLAUDE_ADAPTER_ROSTER || path.join(process.cwd(), "claude-agents.local.json");
const SEED_FILE = path.join(process.cwd(), "claude-agents.json");

function normalizeAgents(list) {
  return list.map((a, i) => {
    const agent = {
      id: a.id || `agent-${i + 1}`,
      name: a.name || a.role || `Agent ${i + 1}`,
      role: a.role || a.name || `Agent${i + 1}`,
      emoji: a.emoji || "🤖",
      seed: true,
      system: a.system || `You are the ${a.name || a.role} agent in a virtual office.`,
    };
    // Preserve department grouping metadata when present (department roster).
    if (a.department) agent.department = a.department;
    if (a.departmentName) agent.departmentName = a.departmentName;
    return agent;
  });
}

// Read an agents array from a roster file. Returns the array (possibly empty)
// when the file exists & parses, or null when it is missing/invalid.
function readRosterFile(file) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const list = Array.isArray(raw) ? raw : Array.isArray(raw.agents) ? raw.agents : null;
    return list ? normalizeAgents(list) : null;
  } catch {
    return null; // missing or invalid
  }
}

function loadRoster() {
  // Highest precedence: departments folder (vn-one-person-company integration).
  const deptsDir = process.env.CLAUDE_ADAPTER_DEPARTMENTS_DIR;
  if (deptsDir) {
    const deptAgents = loadDepartmentRoster(deptsDir);
    if (deptAgents && deptAgents.length > 0) {
      return normalizeAgents(deptAgents);
    }
  }

  // Runtime file wins if present — an explicit empty list means the user
  // cleared the roster and will re-hire, so respect it (do NOT fall back to seed).
  const runtime = readRosterFile(RUNTIME_FILE);
  if (runtime !== null) return runtime;
  const seed = readRosterFile(SEED_FILE);
  if (seed && seed.length) return seed;
  return DEFAULT_ROSTER;
}

const ROSTER = loadRoster();

function buildRegistryPayload(model) {
  return { models: { [model]: { name: model, provider: "anthropic" } } };
}

/**
 * Persist the current agent list to the roster file.
 * Only writes the public fields (id, name, role, emoji, system) — no runtime state.
 * An empty list is valid and writes `{ "agents": [] }` (allows delete-to-zero).
 *
 * @param {Array} agents - current agent list from registry.list()
 * @param {string} [file]  - optional override path (defaults to CLAUDE_ADAPTER_ROSTER env / cwd/claude-agents.json)
 */
function saveRoster(agents, file) {
  const filePath = file || RUNTIME_FILE;
  const payload = {
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      emoji: a.emoji,
      system: a.system,
    })),
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

module.exports = { ROSTER, DEFAULT_ROSTER, loadRoster, saveRoster, DEFAULT_MODEL, buildRegistryPayload, loadDepartmentRoster };
