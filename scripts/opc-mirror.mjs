#!/usr/bin/env node
// scripts/opc-mirror.mjs
// OPC Mirror bridge: reflect vn-opc activity in the 3D office (read-only on the
// vault). vn-opc is the brain; this only mirrors. Polls the vault's task folders
// and the adapter roster, then syncs the office task-store so the agents of any
// department whose meeting is in progress gather in the 3D meeting room, and
// leave again when the meeting finishes.
//
// Usage:
//   node scripts/opc-mirror.mjs               # loop, watch VN_OS_DEFAULT_VAULT
//   node scripts/opc-mirror.mjs --once        # one sync then exit (for testing)
//   node scripts/opc-mirror.mjs --vault "F:/vaults/X"
//   node scripts/opc-mirror.mjs --interval 3000

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const { readAllTasks } = require(path.join(here, "../server/opc-mirror/vault-task-reader.js"));
const { buildDepartmentRoleMap, headsForDepartments } = require(
  path.join(here, "../server/opc-mirror/department-agents.js"),
);

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const ONCE = args.includes("--once");
const VAULT = getArg("--vault", process.env.VN_OS_DEFAULT_VAULT || "");
const INTERVAL = Number(getArg("--interval", "2500"));
const ADAPTER = `http://127.0.0.1:${process.env.CLAUDE_ADAPTER_PORT || 7770}`;
const OFFICE = process.env.OFFICE_BASE_URL || "http://localhost:3000";
const MIRROR_PREFIX = "opc-meeting::";
const RESULT_PREFIX = "opc-result::";

if (!VAULT) {
  console.error("No vault path. Set VN_OS_DEFAULT_VAULT or pass --vault \"...\".");
  process.exit(1);
}

const getJson = async (url) => (await fetch(url)).json();
const putCard = (task) =>
  fetch(`${OFFICE}/api/task-store`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task }),
  });
const archiveCard = (id) =>
  fetch(`${OFFICE}/api/task-store`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });

async function syncOnce() {
  // 1) Current opc activity from the vault.
  const tasks = readAllTasks(VAULT);
  const meetingTasks = tasks.filter((t) => t.meetingActive);
  const resultTasks = tasks.filter((t) => t.hasDecisionReport);

  // 2) Department → office agent roles.
  let deptRoleMap = new Map();
  try {
    const agentsPayload = await getJson(`${ADAPTER}/agents`);
    deptRoleMap = buildDepartmentRoleMap(agentsPayload.agents || []);
  } catch {
    console.warn("[opc-mirror] adapter /agents unreachable — is the adapter running?");
  }

  // 3) Desired cards: one in_progress card per agent of each meeting department.
  const desired = new Map(); // id -> card
  for (const t of meetingTasks) {
    // Only each department's HEAD enters the meeting room (1 representative/dept).
    const heads = headsForDepartments(deptRoleMap, t.departments);
    for (const role of heads) {
      const id = `${MIRROR_PREFIX}${t.id}::${role}`;
      desired.set(id, {
        id,
        title: `Đang họp: ${t.title}`.slice(0, 120),
        description: `vn-opc meeting — phòng ban ${t.departments.join(", ")}`,
        status: "in_progress",
        source: "claw3d_manual",
        assignedAgentId: role,
      });
    }
  }
  // Result cards (done column) for tasks that have a decision report.
  for (const t of resultTasks) {
    const id = `${RESULT_PREFIX}${t.id}`;
    desired.set(id, {
      id,
      title: `📋 Kết luận: ${t.title}`.slice(0, 120),
      description: "vn-opc decision report sẵn sàng trong vault.",
      status: "done",
      source: "claw3d_manual",
      assignedAgentId: null,
    });
  }

  // 4) Reconcile against the office task-store. The mirror OWNS the meeting room:
  //    archive any in_progress card not in the desired set (office brain is off).
  let current = [];
  try {
    const payload = await getJson(`${OFFICE}/api/task-store`);
    current = payload.tasks || payload.cards || [];
  } catch {
    console.warn("[opc-mirror] office task-store unreachable — is the dev server running?");
    return;
  }

  let upserts = 0;
  let archives = 0;
  for (const card of desired.values()) {
    await putCard(card);
    upserts += 1;
  }
  for (const c of current) {
    const isMirror = c.id.startsWith(MIRROR_PREFIX) || c.id.startsWith(RESULT_PREFIX);
    if (c.status === "in_progress" && !desired.has(c.id)) {
      // Any active meeting card not currently desired → meeting ended (or stray
      // manual card). Clear it so agents return to their department.
      await archiveCard(c.id);
      archives += 1;
    } else if (isMirror && c.status !== "in_progress" && !desired.has(c.id)) {
      await archiveCard(c.id);
      archives += 1;
    }
  }

  const inMeeting = [...desired.values()].filter((c) => c.status === "in_progress");
  console.log(
    `[opc-mirror] tasks=${tasks.length} meeting=${meetingTasks.length} ` +
      `agents-in-room=${inMeeting.length} upsert=${upserts} archive=${archives}`,
  );
  if (meetingTasks.length > 0) {
    for (const t of meetingTasks) {
      console.log(`  🟢 ${t.departments.join(", ")} — ${t.title}`);
    }
  }
}

if (ONCE) {
  await syncOnce();
} else {
  console.log(`[opc-mirror] watching ${VAULT} every ${INTERVAL}ms → office (${OFFICE}).`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await syncOnce();
    } catch (err) {
      console.error("[opc-mirror] sync error:", (err && err.message) || err);
    }
    await new Promise((r) => setTimeout(r, INTERVAL));
  }
}
