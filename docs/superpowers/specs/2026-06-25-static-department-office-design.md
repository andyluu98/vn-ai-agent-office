# Static Department Office — Design Spec (2026-06-25)

User-approved. Replaces the bustling office sim's agent behaviour with a calm,
static "team roster in 3D": 33 agents stand still grouped by department; only
summoned agents glide into a meeting room and back.

## Problem (verified, screenshot)
The 7488-line retro-office sim routes agents to desks / roaming / furniture, so
they never settle on the department pads — pads render empty, agents mill in the
furniture area and keep moving. Patching standby branches inside the sim keeps
losing to the desk/roam branches. Names are tiny black boxes, unreadable.

## Decision (user)
- Build a STATIC scene; **replace** the sim's movement + furniture. No toggle.
- Reuse the existing voxel `AgentModel`, camera, orbit, lights, floor/walls
  backdrop, and all HUD/Kanban/ADD/connect chrome (do NOT rebuild those).

## Key mechanism
`AgentModel` reads its position from `renderAgentsRef` each frame and lerps the
visual toward `toWorld(agent.x, agent.y)` (smoothing 0.15). So we control agents
purely by setting `agent.x/agent.y` (canvas coords) — no navigation needed.

Replace the per-frame movement `tick` with a tiny **staticTick**:
- For each office agent: target = meeting seat (if summoned) else its fixed
  department station. Lerp `agent.x/y` toward target (~0.1/frame) → smooth glide
  in/out; constant target → agent settles and stands dead still.
- No A*, no roam, no collision, no desks. Janitors excluded.

## Layout (canvas coords, office footprint 1800×720; `toWorld` maps to world)
Wide-shallow floor → meeting room on the LEFT (full depth), department grid on
the RIGHT. (Deviates from the "front-width" sketch because the floor is shallow;
side-by-side gives a far larger, clearer meeting room. Easy to move later.)
- **Meeting room**: canvas x 30..560, y 30..690. Floor + low walls + long table +
  chairs + "PHÒNG HỌP" sign. Meeting seats = tidy rows in the room; participant
  order i → seat i.
- **Department grid**: zone x 600..1800, y 0..720. 12 clusters in 4×3 via the
  existing tested `computeStandbySeating`. Each cluster: coloured pad + large
  name board + agents standing in a 2-wide micro-grid.

## Components / change points
- `core/standby-seating.ts` — REUSE `computeStandbySeating` for the right zone.
  ADD `computeMeetingSeats(room, count)` (pure, tested): evenly-spaced seats in
  the meeting room; deterministic.
- `RetroOffice3D.tsx`:
  - `STATIC_DEPARTMENT_MODE = true` flag.
  - Gate OUT inside Canvas: furniture Suspense block, ping-pong ball, trails,
    heatmap, edit placement ghosts. KEEP: camera/controls/lights/Environment,
    floor/walls backdrop, `AgentModel` map, dept pads + meeting room geometry.
  - `staticTick` (component scope, uses renderAgentsRef + stations + meeting
    seats); pass `tick={STATIC_DEPARTMENT_MODE ? staticTick : tick}` to
    `SceneGameLoop`.
  - Point dept zone at x 600..1800; enlarge `MEETING_ROOM_RECT` to the left.
- `objects/agents.tsx` — make the always-on mini name label READABLE: larger
  font, solid dark rounded background, light text, sized so it doesn't collide.

## Testing
- Unit: `computeMeetingSeats` — N seats inside room, no overlap, deterministic.
  `computeStandbySeating` (existing tests) — stations stable/in-zone.
- Baseline: only the 5 known pre-existing upstream failures.
- Visual: agents stand still on dept pads; meeting room clearly visible with
  table/chairs; summoned agents glide in and back; names readable.

## Out of scope
- Desks/furniture in the static scene (intentionally removed).
- Camera re-framing (reuse current default; tune only if needed after first view).

## Open questions
- Meeting room left-side vs front-width: shipping left-side for a bigger room;
  confirm or request a move after seeing it.
