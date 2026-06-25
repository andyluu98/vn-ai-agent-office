// server/opc-mirror/vault-task-reader.js
// Pure logic to read a vn-opc vault task folder and derive its status +
// involved departments from the stage files present. The office mirror uses
// this to reflect opc activity without touching opc.
//
// Stage files (in order): 00-brief, 01-routing, 02-context, 03-clarification
// (±-answered), 03b-research-findings, 04-meeting-r1, 05-meeting-r2,
// 06-meeting-r3, 07-decision-report, 08-execution-plan.
//
// Meeting timing: vn_meeting runs in-memory ~60-180s; 04/05/06/07 are written
// only at the end. So a meeting is in progress when 03b exists but 07 does not.

const fs = require("node:fs");
const path = require("node:path");

const has = (files, prefix) => files.some((f) => f.startsWith(prefix));

/** Parse `**Departments:** 07-marketing, 03-finance, …` → ["07-marketing", …]. */
function parseDepartments(routingText) {
  if (!routingText) return [];
  const m = routingText.match(/\*\*Departments:\*\*\s*(.+)/);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    // Keep only department-code shapes like "07-marketing" (digits-dash-word).
    .filter((d) => /^\d{2}-[a-z-]+$/i.test(d));
}

/** Turn "2026-05-08-2011-lap-ke-hoach-marketing" → "lap ke hoach marketing". */
function deriveTitle(folderName) {
  const stripped = folderName.replace(/^\d{4}-\d{2}-\d{2}-\d{3,4}-/, "");
  const slug = stripped || folderName;
  return slug.replace(/-/g, " ").trim();
}

/**
 * @param {{folderName:string, files:string[], routingText?:string, hasOutputs?:boolean}} input
 * @returns {{id:string,title:string,status:string,departments:string[],meetingActive:boolean,hasDecisionReport:boolean}}
 */
function analyzeTask(input) {
  const { folderName, files = [], routingText = "", hasOutputs = false } = input;
  const departments = parseDepartments(routingText);
  const hasDecisionReport = has(files, "07-decision-report");
  // Meeting window: research findings written, decision report not yet.
  const meetingActive = has(files, "03b-research-findings") && !hasDecisionReport;

  let status;
  if (!has(files, "00-brief")) {
    status = "empty";
  } else if (!has(files, "01-routing")) {
    status = "created";
  } else if (has(files, "03-clarification") && !has(files, "03-clarification-answered")) {
    status = "awaiting_clarification";
  } else if (meetingActive) {
    status = "meeting";
  } else if (hasDecisionReport && !has(files, "08-execution-plan")) {
    status = "awaiting_decision";
  } else if (has(files, "08-execution-plan")) {
    status = hasOutputs ? "done" : "awaiting_execution";
  } else {
    // Routed, before research/meeting started.
    status = "ready";
  }

  return {
    id: folderName,
    title: deriveTitle(folderName),
    status,
    departments,
    meetingActive,
    hasDecisionReport,
  };
}

/** Read a task folder from disk and analyze it. */
function readTaskFolder(taskDir, outputsRoot) {
  let files = [];
  try {
    files = fs.readdirSync(taskDir);
  } catch {
    files = [];
  }
  let routingText = "";
  const routingFile = files.find((f) => f.startsWith("01-routing"));
  if (routingFile) {
    try {
      routingText = fs.readFileSync(path.join(taskDir, routingFile), "utf8");
    } catch {
      routingText = "";
    }
  }
  const folderName = path.basename(taskDir);
  // Outputs live in <vault>/03-Outputs/<task-name>/ with rendered files.
  let hasOutputs = false;
  if (outputsRoot) {
    try {
      const outDir = path.join(outputsRoot, folderName);
      hasOutputs = fs.existsSync(outDir) &&
        fs.readdirSync(outDir).some((f) => /\.(docx|xlsx|pdf)$/i.test(f));
    } catch {
      hasOutputs = false;
    }
  }
  return analyzeTask({ folderName, files, routingText, hasOutputs });
}

/** List + analyze all task folders under <vault>/02-Tasks. */
function readAllTasks(vaultDir) {
  const tasksRoot = path.join(vaultDir, "02-Tasks");
  const outputsRoot = path.join(vaultDir, "03-Outputs");
  let entries = [];
  try {
    entries = fs.readdirSync(tasksRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => readTaskFolder(path.join(tasksRoot, e.name), outputsRoot))
    .filter((t) => t.status !== "empty");
}

module.exports = {
  analyzeTask,
  parseDepartments,
  deriveTitle,
  readTaskFolder,
  readAllTasks,
};
