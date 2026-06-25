import type { DistrictZone } from "@/features/retro-office/core/district";
import { snap } from "@/features/retro-office/core/geometry";

// ── Stable standby seating ───────────────────────────────────────────────────
//
// Assigns every department agent a FIXED standing spot in the standby area,
// grouped into per-department clusters laid out in a 4×3 grid.
//
// Key property: the assignment is fully DETERMINISTIC and ORDER-INDEPENDENT.
// Departments are sorted by their code, and agents within a department by id —
// so the same set of agents always yields the same seats regardless of the
// order they arrive in. The caller passes the FULL roster (including agents
// currently summoned to a meeting) so each seat is permanently reserved and
// summoning one agent never reshuffles the others.

const CLUSTER_COLS = 4;
const CLUSTER_ROWS = 3;
// Padding inside the standby zone before the first cluster cell.
const ZONE_PAD_X = 30;
const ZONE_PAD_Y = 44;
// Gaps between cluster cells.
const GAP_X = 24;
const GAP_Y = 70;
// Agent micro-grid inside a cluster cell: 2 columns, generous spacing so the
// always-on name labels don't collide.
const AGENTS_PER_ROW = 2;
const AGENT_SLOT_W = 110;
const AGENT_SLOT_H = 72;
// Inset of the first agent slot from the cell's top-left (leaves room for the
// department label that floats above the cell).
const AGENTS_INSET_X = 30;
const AGENTS_INSET_Y = 30;
// Standby agents face the meeting room (to the left, −X) — "ready to be summoned".
const STANDBY_FACING = -Math.PI / 2;

export type StandbyAgentInput = {
  id: string;
  department?: string | null;
  departmentName?: string | null;
};

export type StandbySeat = {
  x: number;
  y: number;
  facing: number;
  department: string;
  departmentName: string;
};

export type StandbyClusterBox = {
  department: string;
  departmentName: string;
  /** Top-left canvas corner of the cluster cell. */
  originX: number;
  originY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  /** Canvas Y for the floating department-name label (above the cell). */
  labelY: number;
  agentCount: number;
};

export type StandbySeating = {
  seats: Map<string, StandbySeat>;
  clusters: StandbyClusterBox[];
};

const normalizeDept = (dept: string | null | undefined): string =>
  dept?.trim() || "default";

/**
 * Compute fixed standby seats + department cluster boxes.
 * @param agents Full roster of department agents (order does not matter).
 * @param zone   Standby area canvas rect.
 */
export const computeStandbySeating = (
  agents: StandbyAgentInput[],
  zone: DistrictZone,
): StandbySeating => {
  // Group agents by normalized department code.
  const byDept = new Map<string, { name: string; ids: string[] }>();
  for (const a of agents) {
    const code = normalizeDept(a.department);
    const entry = byDept.get(code);
    if (entry) {
      entry.ids.push(a.id);
      if (entry.name === code && a.departmentName?.trim()) {
        entry.name = a.departmentName.trim();
      }
    } else {
      byDept.set(code, { name: a.departmentName?.trim() || code, ids: [a.id] });
    }
  }

  // Stable department order: sort by department code.
  const deptCodes = [...byDept.keys()].sort((l, r) => (l < r ? -1 : l > r ? 1 : 0));

  // Cluster cell geometry.
  const zoneW = zone.maxX - zone.minX;
  const zoneH = zone.maxY - zone.minY;
  const cellW = (zoneW - ZONE_PAD_X * 2 - GAP_X * (CLUSTER_COLS - 1)) / CLUSTER_COLS;
  const cellH = (zoneH - ZONE_PAD_Y * 2 - GAP_Y * (CLUSTER_ROWS - 1)) / CLUSTER_ROWS;

  const seats = new Map<string, StandbySeat>();
  const clusters: StandbyClusterBox[] = [];

  deptCodes.forEach((code, deptIdx) => {
    const { name, ids } = byDept.get(code)!;
    const col = deptIdx % CLUSTER_COLS;
    const row = Math.floor(deptIdx / CLUSTER_COLS);
    const originX = zone.minX + ZONE_PAD_X + col * (cellW + GAP_X);
    const originY = zone.minY + ZONE_PAD_Y + row * (cellH + GAP_Y);

    clusters.push({
      department: code,
      departmentName: name,
      originX: snap(originX),
      originY: snap(originY),
      width: snap(cellW),
      height: snap(cellH),
      centerX: snap(originX + cellW / 2),
      centerY: snap(originY + cellH / 2),
      labelY: snap(originY - 16),
      agentCount: ids.length,
    });

    // Stable agent order within the department: sort by id.
    const orderedIds = [...ids].sort((l, r) => (l < r ? -1 : l > r ? 1 : 0));
    orderedIds.forEach((id, slotIdx) => {
      const slotCol = slotIdx % AGENTS_PER_ROW;
      const slotRow = Math.floor(slotIdx / AGENTS_PER_ROW);
      const rawX = originX + AGENTS_INSET_X + slotCol * AGENT_SLOT_W;
      const rawY = originY + AGENTS_INSET_Y + slotRow * AGENT_SLOT_H;
      const x = Math.max(zone.minX + 8, Math.min(zone.maxX - 8, snap(rawX)));
      const y = Math.max(zone.minY + 8, Math.min(zone.maxY - 8, snap(rawY)));
      seats.set(id, {
        x,
        y,
        facing: STANDBY_FACING,
        department: code,
        departmentName: name,
      });
    });
  });

  return { seats, clusters };
};
