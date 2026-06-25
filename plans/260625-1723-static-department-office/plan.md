# Plan — Static Department Office (260625-1723)

Spec: `docs/superpowers/specs/2026-06-25-static-department-office-design.md`
Approach: reuse AgentModel + camera + floor/walls; replace movement tick with
staticTick; gate out furniture/effects; meeting room left, dept grid right.

## Phases (each → verify)
- [ ] P1 `computeMeetingSeats` pure fn + tests (TDD) → vitest green
- [ ] P2 staticTick in RetroOffice3D (stations = computeStandbySeating right-zone;
      meeting seats for participants) → pass to SceneGameLoop
- [ ] P3 Gate out furniture block / pingpong / trails / heatmap / placement ghosts
      behind STATIC_DEPARTMENT_MODE; keep floor/walls/agents/camera
- [ ] P4 Point dept zone → {600..1800, 0..720}; enlarge MEETING_ROOM_RECT → left
      full-depth; ensure pads + meeting geometry render
- [ ] P5 Readable agent mini-label in objects/agents.tsx
- [ ] P6 typecheck + build + full test (baseline 5 fail) → user visual confirm

## Success
33 agents stand still on dept pads; meeting room clearly visible (table/chairs);
summoned agents glide in & back; names readable; no roaming/furniture.
