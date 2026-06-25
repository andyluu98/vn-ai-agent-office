# OPC Mirror — Design Spec (2026-06-25)

User vision: **vn-opc is the brain** (runs real work, owns the vault, via its MCP).
The **3D office is purely a mirror** — it shows users what the opc agents are
doing. Office must NOT run its own meetings; opc is the single source of truth.

## Verified facts (from vn-opc repo + real vault `<vault>`)
- Each task = a folder in `<vault>/02-Tasks/<YYYY-MM-DD-HHMM>-<slug>/`.
- Stage files accrue: `00-brief` → `01-routing` → `02-context` → `03-clarification`(±answered)
  → `03b-research-findings` → `04-meeting-r1` → `05-meeting-r2` → `06-meeting-r3`
  → `07-decision-report` → `08-execution-plan`.
- `01-routing.md` names departments: `**Departments:** 07-marketing, 03-finance, …`
  (codes match `departments/` folders AND the office agents' `department` field).
- Meetings are at **DEPARTMENT** level (not individual agents).
- Meeting runs in-memory ~60-180s; files 04/05/06/07 written only at the END.
  → **"meeting in progress NOW" = `03b` exists AND `04` absent.** No opc change/wrapper needed.
- `vn_status` is company-level only (no per-agent/per-meeting live state) — not used.

## Architecture — vault-watch → task-store bridge
```
You/Claude Code --MCP--> vn-opc (runs) --writes--> VAULT/02-Tasks/* + decision reports
                                                          │ (poll ~2s, read-only)
                                          opc-mirror bridge (node)
                                                          │ upsert/archive cards
                                              office task-store  ──►  Office 3D (existing pipeline)
```
The office already derives meeting participants from task-store `in_progress`
cards (assignedAgentId). The bridge just keeps task-store in sync with the vault:
- For a task whose meeting is in progress (`03b && !04`): upsert an `in_progress`
  card per office agent in each routed department → those departments gather in
  the 3D meeting room.
- When `07-decision-report.md` appears: archive the meeting cards (agents return)
  and write one `done` card "📋 Kết luận: <task>" (so the result shows on the board).
- Department code → office agents: from adapter `GET /agents` (each agent has
  `department` + `role`); invert to department→[roles].

No opc changes. No wrapper. Office brain (office-command/orchestrator) is OFF.

## Components
- `server/opc-mirror/vault-task-reader.js` (pure, TDD): given a task folder's
  file list + routing text → `{ id, title, status, departments[], meetingActive, hasDecisionReport }`.
  Status = file-based state machine (created/routed/awaiting_clarification/
  ready/meeting/awaiting_decision/awaiting_execution/done).
- `server/opc-mirror/department-agents.js`: build department→roles from `/agents`.
- `scripts/opc-mirror.mjs`: poll loop → diff → upsert/archive task-store cards.
- Vault path from `VN_OS_DEFAULT_VAULT` (default `<vault>`) or `--vault`.
- Office brain OFF: `/command` returns 409 "mirror mode" when `OFFICE_MIRROR_MODE=1`.

## Testing
- Unit: vault-task-reader on synthetic file sets + real folder shapes (meeting,
  paused-clarification, done, brief-only). Deterministic.
- Live: run bridge against `<vault>` (read-only) → verify 11 tasks
  classify correctly; create ONE temp meeting-active task folder to show the
  office animating, then remove it.
- Baseline: only the 5 known pre-existing upstream test failures.

## Out of scope (for now)
- Writing meeting results back anywhere (opc already owns the vault).
- Per-agent (vs per-department) meeting granularity (opc is department-level).
- Showing research/execution stages as distinct animations (only meeting + done now).

## Open questions
- Show ALL agents of a meeting department, or just the department head? (Start: all.)
