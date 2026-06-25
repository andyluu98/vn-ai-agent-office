# Office Standby Layout — Design Spec (2026-06-25)

> Refinement of the VN-company office integration. User-approved design.

## Goal
A clean, static standby office: all ~33 department agents stand still in tidy per-department clusters with small always-on name labels; only summoned agents move into the meeting room and back. Remove leftover gym/QA furniture and hide the second (remote) office.

## Requirements (user-confirmed)
1. **Small persistent agent labels.** Every agent shows a SMALL short name (e.g. `name_vn` like "Cán bộ Pháp chế") above its head at all times. On hover / selected / in-meeting → larger full label (current rich nameplate). (Reverts the over-aggressive hover-only declutter from Layer 2B.)
2. **12 department clusters spread evenly** across the standby area (gym/QA space reclaimed). Each cluster has a department-name label (larger than agent labels). Agents sit in a stable grid inside their cluster, well-spaced so labels don't collide. No center clumping.
3. **Agents stand still.** Non-summoned agents hold their standby spot (no roaming/jitter). Summoned agents (in_progress task / meeting participants) walk to the meeting room; when the meeting ends they return to their standby spot.
4. **Auto-clean saved layout.** A one-time migration on furniture load strips gym/QA furniture types (e.g. `treadmill`, `qa_terminal`, gym/qa props) from the persisted localStorage layout so leftover objects disappear.
5. **Hide the second office.** The remote/second office (rendered below) is hidden by default so only one clean office shows.

## Architecture / change points (verified)
- **Labels:** agent nameplate rendering in `src/features/retro-office/RetroOffice3D.tsx` (and/or `src/features/retro-office/objects/agents.tsx`). Add a small always-on label; keep the rich label gated on hover/selected/in-meeting. Department cluster labels already added in Layer 2B (`DepartmentClusterLabels`) — keep, ensure larger than agent labels.
- **Cluster layout:** `computeClusterLayout` + `resolveStandbyTarget` in `src/features/retro-office/core/navigation.ts`. Spread 12 clusters evenly across the standby zone (`STANDBY_AREA_ZONE` in `core/district.ts`), stable per-agent slots, comfortable spacing.
- **Stand still:** in `RetroOffice3D.tsx` agent tick, non-summoned agents target their standby spot and HOLD (no roam). Summoned → `resolveMeetingTarget`.
- **Furniture migration:** where furniture loads from localStorage (`STORAGE_KEY` in `core/constants.ts`; loader likely in office builder store / `furnitureDefaults.ts` or the office state hook). Add a filter that drops gym/QA furniture types on load (idempotent).
- **Hide second office:** the `showRemoteOffice`/`remoteOfficeEnabled` flag feeding `FloorAndWalls showRemoteOffice` and remote agents — default it off (when not explicitly enabled).

## Testing
- Unit: cluster layout — N departments tile without overlap, stable positions, agents within zone; furniture migration — gym/QA types removed, others kept, idempotent.
- Keep baseline: only the 5 known pre-existing upstream test failures.
- Visual: user confirms labels readable + clusters tidy + no leftover gym/QA + single office.

## Out of scope
- Furniture/desks for the standby clusters (agents stand in open clusters for now).
- Deep meeting-room redecoration (already enlarged in Layer 2).

## Open questions
- None blocking. Exact spacing/label sizes will be tuned visually after first render.
