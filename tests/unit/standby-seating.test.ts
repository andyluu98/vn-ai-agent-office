import { describe, expect, it } from "vitest";
import { STANDBY_AREA_ZONE } from "@/features/retro-office/core/district";
import { computeStandbySeating } from "@/features/retro-office/core/standby-seating";

type A = { id: string; department?: string | null; departmentName?: string | null };

const ROSTER: A[] = [
  { id: "a1", department: "01-gov", departmentName: "Quản trị & Pháp lý" },
  { id: "a2", department: "01-gov", departmentName: "Quản trị & Pháp lý" },
  { id: "b1", department: "02-fin", departmentName: "Tài chính & Kế toán" },
  { id: "b2", department: "02-fin", departmentName: "Tài chính & Kế toán" },
  { id: "b3", department: "02-fin", departmentName: "Tài chính & Kế toán" },
  { id: "c1", department: "03-mkt", departmentName: "Marketing & Thương hiệu" },
];

describe("computeStandbySeating", () => {
  it("places every agent and groups departments into clusters", () => {
    const { seats, clusters } = computeStandbySeating(ROSTER, STANDBY_AREA_ZONE);
    expect(seats.size).toBe(ROSTER.length);
    expect(clusters.length).toBe(3); // 3 distinct departments
    const fin = clusters.find((c) => c.department === "02-fin");
    expect(fin?.departmentName).toBe("Tài chính & Kế toán");
    expect(fin?.agentCount).toBe(3);
  });

  it("is order-independent — same set in any order yields identical seats", () => {
    const a = computeStandbySeating(ROSTER, STANDBY_AREA_ZONE);
    const shuffled = [...ROSTER].reverse();
    const b = computeStandbySeating(shuffled, STANDBY_AREA_ZONE);
    for (const agent of ROSTER) {
      expect(b.seats.get(agent.id)).toEqual(a.seats.get(agent.id));
    }
  });

  it("keeps a department-mate's seat stable when another mate is added/removed", () => {
    // Full roster reserves seats; b1's seat must not depend on b2/b3 presence
    // because the caller always passes the FULL roster (summoned agents kept).
    const full = computeStandbySeating(ROSTER, STANDBY_AREA_ZONE);
    const seatB1Full = full.seats.get("b1");
    // Recompute with the SAME full set but different order — b1 unchanged.
    const reordered = computeStandbySeating(
      [ROSTER[4], ROSTER[2], ROSTER[3], ROSTER[0], ROSTER[1], ROSTER[5]],
      STANDBY_AREA_ZONE,
    );
    expect(reordered.seats.get("b1")).toEqual(seatB1Full);
  });

  it("places all seats inside the standby zone", () => {
    const { seats } = computeStandbySeating(ROSTER, STANDBY_AREA_ZONE);
    for (const seat of seats.values()) {
      expect(seat.x).toBeGreaterThanOrEqual(STANDBY_AREA_ZONE.minX);
      expect(seat.x).toBeLessThanOrEqual(STANDBY_AREA_ZONE.maxX);
      expect(seat.y).toBeGreaterThanOrEqual(STANDBY_AREA_ZONE.minY);
      expect(seat.y).toBeLessThanOrEqual(STANDBY_AREA_ZONE.maxY);
    }
  });

  it("gives every agent a distinct standing spot (no overlap)", () => {
    const { seats } = computeStandbySeating(ROSTER, STANDBY_AREA_ZONE);
    const keys = new Set<string>();
    for (const seat of seats.values()) {
      keys.add(`${seat.x},${seat.y}`);
    }
    expect(keys.size).toBe(seats.size);
  });

  it("lays out 12 departments in a 4x3 grid without overlapping cells", () => {
    const roster: A[] = Array.from({ length: 12 }, (_, i) => ({
      id: `dept${i}-agent`,
      department: `${String(i).padStart(2, "0")}-d`,
      departmentName: `Phòng ${i}`,
    }));
    const { clusters } = computeStandbySeating(roster, STANDBY_AREA_ZONE);
    expect(clusters.length).toBe(12);
    // No two cluster cells overlap.
    for (let i = 0; i < clusters.length; i += 1) {
      for (let j = i + 1; j < clusters.length; j += 1) {
        const a = clusters[i];
        const b = clusters[j];
        const overlapX = a.originX < b.originX + b.width && b.originX < a.originX + a.width;
        const overlapY = a.originY < b.originY + b.height && b.originY < a.originY + a.height;
        expect(overlapX && overlapY).toBe(false);
      }
    }
  });
});
