// server/claude-code-adapter/orchestrator.js
// Orchestrator brain: decompose a user goal into a task list via one claude -p call.
// All logic is pure/injectable for TDD.
"use strict";

const ORCHESTRATOR_SYSTEM =
  "You are an Orchestrator. Decompose the given goal into a list of tasks. " +
  "Reply with ONLY a valid JSON array — no prose, no markdown fences. " +
  "Each item: { \"title\": string, \"description\": string, \"role\": string }.";

/**
 * Build the decompose prompt sent to Claude.
 * Instructs Claude to return ONLY a JSON array of task objects.
 *
 * @param {string} goal         - the user's high-level goal
 * @param {string[]} roles      - available agent roles to assign tasks to
 * @returns {string}
 */
function buildDecomposePrompt(goal, roles) {
  return (
    `Goal: ${goal}\n\n` +
    `Available roles: ${roles.join(", ")}\n\n` +
    "Return ONLY a JSON array — exactly like this example (1–8 items):\n" +
    '[\n' +
    '  { "title": "<short task name>", "description": "<what to do>", "role": "<one of the roles above>" }\n' +
    ']\n\n' +
    "No prose before or after. No markdown code fences. Only the raw JSON array."
  );
}

/**
 * Scan forward from startIndex to find the matching closing bracket `]`,
 * correctly handling nested arrays/objects and string literals.
 *
 * @param {string} text
 * @param {number} startIndex  index of the opening `[`
 * @returns {string|null}  the balanced substring or null if unbalanced
 */
function extractJsonArray(text, startIndex) {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "[" || ch === "{") depth++;
    else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) return text.slice(startIndex, i + 1);
    }
  }
  return null;
}

/**
 * Extract and parse the first JSON array from text (tolerates surrounding prose).
 * Validates each item has a non-empty title; drops invalid items.
 * Caps result to maxTasks.
 *
 * @param {string} text
 * @param {number} [maxTasks=8]
 * @returns {Array<{title:string, description:string, role:string}>}
 */
function parseTaskList(text, maxTasks = 8) {
  if (typeof text !== "string") return [];

  // Find the first `[`
  const bracketIdx = text.indexOf("[");
  if (bracketIdx === -1) return [];

  const jsonStr = extractJsonArray(text, bracketIdx);
  if (!jsonStr) return [];

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  // Validate items: must have non-empty title
  const valid = parsed.filter(
    (item) =>
      item &&
      typeof item === "object" &&
      typeof item.title === "string" &&
      item.title.trim().length > 0
  );

  return valid.slice(0, maxTasks).map((item) => ({
    title: String(item.title).trim(),
    description: typeof item.description === "string" ? item.description : "",
    role: typeof item.role === "string" ? item.role : "",
  }));
}

/**
 * Call Claude once to decompose a goal into tasks.
 *
 * @param {{
 *   goal: string,
 *   roles: string[],
 *   runner: (opts: {prompt:string, system:string, model:string}) => Promise<{text:string, isError:boolean}>,
 *   model: string,
 *   maxTasks?: number
 * }} opts
 * @returns {Promise<Array<{title:string, description:string, role:string}>>}
 */
async function decomposeGoal({ goal, roles, runner, model, maxTasks = 8 }) {
  const prompt = buildDecomposePrompt(goal, roles);
  const result = await runner({ prompt, system: ORCHESTRATOR_SYSTEM, model });

  if (!result || result.isError) {
    throw new Error(`Orchestrator error: ${(result && result.text) || "unknown error"}`);
  }

  const tasks = parseTaskList(result.text, maxTasks);
  if (tasks.length === 0) {
    throw new Error(`Orchestrator returned no parseable tasks. Raw response: ${String(result.text).slice(0, 200)}`);
  }

  return tasks;
}

module.exports = { buildDecomposePrompt, parseTaskList, decomposeGoal };
