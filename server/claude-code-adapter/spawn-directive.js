// server/claude-code-adapter/spawn-directive.js
// Parses [[SPAWN: {...}]] directives from an assistant reply text.
// Only successfully-parsed JSON directives are collected and stripped.
// Malformed directives are left in the text untouched.
"use strict";

const MAX_SYSTEM_LENGTH = 4000; // M-4: cap system prompt to prevent oversized prompts

/**
 * I-1: Scan forward from `startIndex` counting brace depth to extract the full
 * JSON object, correctly handling `{...}` patterns inside string values.
 * Returns the substring including the outer braces, or null if braces don't balance.
 *
 * @param {string} text
 * @param {number} startIndex  index of the opening `{`
 * @returns {string|null}
 */
function extractJsonObject(text, startIndex) {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(startIndex, i + 1);
      }
    }
  }
  return null; // unbalanced
}

/**
 * Parse spawn directives from assistant reply text.
 * Handles multi-line JSON and `system` fields that contain `{...}` patterns.
 *
 * @param {string} text - raw assistant reply
 * @returns {{ agents: Array<{role,name?,system?,emoji?}>, cleanedText: string }}
 */
function parseSpawnDirectives(text) {
  if (typeof text !== "string") return { agents: [], cleanedText: String(text ?? "") };

  const SPAWN_PREFIX = "[[SPAWN:";
  const agents = [];
  // Each entry: { start, end } indices of the complete [[SPAWN: {...}]] span
  const spans = [];

  let searchFrom = 0;
  while (true) {
    const prefixIdx = text.indexOf(SPAWN_PREFIX, searchFrom);
    if (prefixIdx === -1) break;

    // Skip whitespace after "[[SPAWN:"
    let jsonStart = prefixIdx + SPAWN_PREFIX.length;
    while (jsonStart < text.length && (text[jsonStart] === " " || text[jsonStart] === "\t" || text[jsonStart] === "\n" || text[jsonStart] === "\r")) {
      jsonStart++;
    }

    if (jsonStart >= text.length || text[jsonStart] !== "{") {
      // Not a valid directive start — skip past the prefix
      searchFrom = prefixIdx + SPAWN_PREFIX.length;
      continue;
    }

    const jsonStr = extractJsonObject(text, jsonStart);
    if (!jsonStr) {
      searchFrom = prefixIdx + SPAWN_PREFIX.length;
      continue;
    }

    // After the JSON object, find the closing "]]" (allow intervening whitespace/newlines)
    const afterJson = jsonStart + jsonStr.length;
    let closingSearch = afterJson;
    while (closingSearch < text.length && (text[closingSearch] === " " || text[closingSearch] === "\t" || text[closingSearch] === "\n" || text[closingSearch] === "\r")) {
      closingSearch++;
    }

    if (text.slice(closingSearch, closingSearch + 2) !== "]]") {
      // No closing "]]" — not a valid directive
      searchFrom = prefixIdx + SPAWN_PREFIX.length;
      continue;
    }

    const spanEnd = closingSearch + 2; // past "]]"

    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed === "object") {
        // M-4: cap system prompt length to avoid oversized prompts
        if (typeof parsed.system === "string" && parsed.system.length > MAX_SYSTEM_LENGTH) {
          parsed.system = parsed.system.slice(0, MAX_SYSTEM_LENGTH);
        }
        agents.push(parsed);
        spans.push({ start: prefixIdx, end: spanEnd });
      }
    } catch {
      // Malformed JSON — leave the directive text untouched
    }

    searchFrom = spanEnd;
  }

  // Strip valid directive spans (iterate in reverse order to keep indices stable)
  let cleanedText = text;
  for (let i = spans.length - 1; i >= 0; i--) {
    const { start, end } = spans[i];
    cleanedText = cleanedText.slice(0, start) + cleanedText.slice(end);
  }
  // Collapse runs of 3+ newlines down to 2 (preserve intentional paragraph breaks)
  cleanedText = cleanedText.replace(/\n{3,}/g, "\n\n").trim();

  return { agents, cleanedText };
}

module.exports = { parseSpawnDirectives };
