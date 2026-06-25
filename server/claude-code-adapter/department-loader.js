// server/claude-code-adapter/department-loader.js
// Reads agent roster from a vn-one-person-company departments/ folder.
// Each <dept>/agents/*.md becomes one agent entry.
// No external deps — YAML frontmatter parsed with simple line scanning.
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const MAX_SYSTEM_CHARS = 1500;

/**
 * Parse YAML frontmatter (between first ---...--- delimiters) for scalar string
 * fields only (id, name_vn, emoji, department).
 * Returns extracted fields or null if no frontmatter / no id+name found.
 *
 * @param {string} text  - full file content
 * @returns {{ id?: string, name?: string, emoji?: string, department?: string, system?: string } | null}
 */
function parseAgentMarkdown(text) {
  if (typeof text !== "string") return null;

  // Find first frontmatter block: starts with --- on its own line
  const fmStart = text.indexOf("---");
  if (fmStart === -1) return null;
  const afterOpen = text.indexOf("\n", fmStart);
  if (afterOpen === -1) return null;
  const fmEnd = text.indexOf("\n---", afterOpen);
  if (fmEnd === -1) return null;

  const frontmatter = text.slice(afterOpen + 1, fmEnd);
  const body = text.slice(fmEnd + 4); // skip "\n---"

  // Parse scalar lines: "key: value" — skip lines starting with spaces (list items / nested)
  const fields = {};
  for (const line of frontmatter.split("\n")) {
    if (!line || /^\s/.test(line)) continue; // skip list items / blank
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, ""); // strip quotes
    if (val && !val.startsWith("[") && !val.startsWith("{")) {
      fields[key] = val;
    }
  }

  const id = fields["id"] || null;
  const name = fields["name_vn"] || null;
  if (!id || !name) return null;

  // Extract system from ## Vai trò section, else whole body (capped)
  const system = extractSystem(body);

  return {
    id,
    name,
    emoji: fields["emoji"] || null,
    department: fields["department"] || null,
    system,
  };
}

/**
 * Extract system prompt text from markdown body.
 * Looks for "## Vai trò" heading and takes paragraph up to next "## ".
 * Falls back to full body (trimmed, capped at MAX_SYSTEM_CHARS).
 *
 * @param {string} body - text after frontmatter closing ---
 * @returns {string}
 */
function extractSystem(body) {
  const roleHeading = /^## Vai trò\s*$/m;
  const match = roleHeading.exec(body);
  if (match) {
    const start = match.index + match[0].length;
    const rest = body.slice(start);
    const nextSection = /^## /m.exec(rest);
    const roleText = nextSection ? rest.slice(0, nextSection.index) : rest;
    const trimmed = roleText.trim();
    return trimmed.slice(0, MAX_SYSTEM_CHARS);
  }
  const trimmed = body.trim();
  return trimmed.slice(0, MAX_SYSTEM_CHARS);
}

/**
 * Parse department.yaml for code and name_vn scalar fields.
 *
 * @param {string} text
 * @returns {{ code?: string, nameVn?: string }}
 */
function parseDepartmentYaml(text) {
  if (typeof text !== "string") return {};
  const result = {};
  for (const line of text.split("\n")) {
    if (!line || /^\s/.test(line)) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
    if (!val || val.startsWith("[") || val.startsWith("{")) continue;
    if (key === "code") result.code = val;
    if (key === "name_vn") result.nameVn = val;
  }
  return result;
}

/**
 * Load all agents from a departments directory.
 * Scans immediate subdirectories; for each with an agents/ folder,
 * reads department.yaml and each agents/*.md.
 *
 * @param {string} dir  - path to departments root
 * @returns {Array<{id,name,role,emoji,system,department,departmentName}> | null}
 */
function loadDepartmentRoster(dir) {
  if (!dir || typeof dir !== "string") return null;

  let dirEntries;
  try {
    dirEntries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null; // dir doesn't exist or not readable
  }

  const allAgents = [];
  // Track id and role collisions across all departments
  const seenIds = new Map(); // id -> count
  const seenRoles = new Map(); // role -> count

  for (const entry of dirEntries) {
    if (!entry.isDirectory()) continue;
    const deptDir = path.join(dir, entry.name);
    const agentsDir = path.join(deptDir, "agents");

    // Must have an agents/ folder
    let agentFiles;
    try {
      agentFiles = fs.readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
    } catch {
      continue; // no agents folder — skip
    }

    // Read department metadata
    let deptCode = entry.name; // fallback
    let deptNameVn = entry.name;
    try {
      const yamlText = fs.readFileSync(path.join(deptDir, "department.yaml"), "utf8");
      const meta = parseDepartmentYaml(yamlText);
      if (meta.code) deptCode = meta.code;
      if (meta.nameVn) deptNameVn = meta.nameVn;
    } catch {
      // department.yaml missing — use folder name
    }

    for (const file of agentFiles) {
      const filePath = path.join(agentsDir, file);
      let parsed;
      try {
        const text = fs.readFileSync(filePath, "utf8");
        parsed = parseAgentMarkdown(text);
      } catch {
        continue;
      }
      if (!parsed) continue;

      const baseId = parsed.id || file.replace(/\.md$/, "");
      const name = parsed.name;
      const emoji = parsed.emoji || "🧑‍💼";
      const system = parsed.system || `Bạn là ${name}.`;

      // Ensure unique id
      let uniqueId = baseId;
      const idCount = seenIds.get(baseId) || 0;
      if (idCount > 0) uniqueId = `${baseId}-${idCount + 1}`;
      seenIds.set(baseId, idCount + 1);

      // role must be unique — use name; on collision append dept
      let role = name;
      const roleCount = seenRoles.get(role) || 0;
      if (roleCount > 0) {
        role = `${name} · ${deptNameVn || deptCode}`;
        // If still colliding (very unlikely), append counter
        const role2Count = seenRoles.get(role) || 0;
        if (role2Count > 0) {
          role = `${role} ${role2Count + 1}`;
        }
        seenRoles.set(role, (seenRoles.get(role) || 0) + 1);
      } else {
        seenRoles.set(role, 1);
      }

      allAgents.push({
        id: uniqueId,
        name,
        role,
        emoji,
        system,
        department: deptCode,
        departmentName: deptNameVn,
      });
    }
  }

  return allAgents.length > 0 ? allAgents : null;
}

module.exports = { parseAgentMarkdown, parseDepartmentYaml, loadDepartmentRoster };
