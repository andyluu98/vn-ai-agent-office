// server/claude-code-adapter/spawn-directive.js
// Parses [[SPAWN: {...}]] directives from an assistant reply text.
// Only successfully-parsed JSON directives are collected and stripped.
// Malformed directives are left in the text untouched.
"use strict";

// Matches [[SPAWN: <json-object>]] — non-greedy, single-line JSON expected.
const DIRECTIVE_RE = /\[\[SPAWN:\s*(\{.*?\})\s*\]\]/g;

/**
 * Parse spawn directives from assistant reply text.
 *
 * @param {string} text - raw assistant reply
 * @returns {{ agents: Array<{role,name?,system?,emoji?}>, cleanedText: string }}
 */
function parseSpawnDirectives(text) {
  if (typeof text !== "string") return { agents: [], cleanedText: String(text ?? "") };

  const agents = [];
  // Track which full match strings to remove (only valid ones)
  const toStrip = [];

  let match;
  // Reset lastIndex before iterating
  DIRECTIVE_RE.lastIndex = 0;
  while ((match = DIRECTIVE_RE.exec(text)) !== null) {
    const fullMatch = match[0];
    const jsonStr = match[1];
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed === "object") {
        agents.push(parsed);
        toStrip.push(fullMatch);
      }
    } catch {
      // Malformed JSON — leave the directive text untouched
    }
  }

  // Strip only the valid directives; clean up leftover blank lines
  let cleanedText = text;
  for (const marker of toStrip) {
    cleanedText = cleanedText.replace(marker, "");
  }
  // Collapse runs of 3+ newlines down to 2 (preserve intentional paragraph breaks)
  cleanedText = cleanedText.replace(/\n{3,}/g, "\n\n").trim();

  return { agents, cleanedText };
}

module.exports = { parseSpawnDirectives };
