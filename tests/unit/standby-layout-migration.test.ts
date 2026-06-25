/**
 * Tests for R2 (cluster layout) and R4 (gym/QA furniture migration).
 *
 * R2: computeClusterLayout tiles 12 departments evenly across the standby zone.
 * R4: stripGymQaFurniture removes gym/QA types and is idempotent.
 */

import { describe, expect, it } from "vitest";

import {
  computeClusterLayout,
  resolveStandbyTarget,
} from "@/features/retro-office/core/navigation";
import { STANDBY_AREA_ZONE } from "@/features/retro-office/core/district";
import {
  stripGymQaFurniture,
  GYM_QA_FURNITURE_TYPES,
} from "@/features/retro-office/core/furnitureDefaults";
import type { FurnitureItem } from "@/features/retro-office/core/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeDepts = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    department: `dept-${i + 1}`,
    departmentName: `Department ${i + 1}`,
  }));

const makeFurniture = (type: string, uid: string): FurnitureItem => ({
  _uid: uid,
  type,
  x: 100,
  y: 100,
});

// ---------------------------------------------------------------------------
// R2 — computeClusterLayout
// ---------------------------------------------------------------------------

describe("computeClusterLayout — R2 cluster grid", () => {
  it("returns exactly N clusters for N departments", () => {
    const clusters = computeClusterLayout(makeDepts(12), STANDBY_AREA_ZONE);
    expect(clusters).toHaveLength(12);
  });

  it("all clusters fall within the standby zone bounds", () => {
    const clusters = computeClusterLayout(makeDepts(12), STANDBY_AREA_ZONE);
    for (const c of clusters) {
      expect(c.originX).toBeGreaterThanOrEqual(STANDBY_AREA_ZONE.minX);
      expect(c.originY).toBeGreaterThanOrEqual(STANDBY_AREA_ZONE.minY);
      expect(c.originX).toBeLessThan(STANDBY_AREA_ZONE.maxX);
      expect(c.originY).toBeLessThan(STANDBY_AREA_ZONE.maxY);
    }
  });

  it("no two cluster origins are identical (no stacking)", () => {
    const clusters = computeClusterLayout(makeDepts(12), STANDBY_AREA_ZONE);
    const originKeys = clusters.map((c) => `${c.originX}:${c.originY}`);
    const uniqueKeys = new Set(originKeys);
    expect(uniqueKeys.size).toBe(12);
  });

  it("cluster positions are deterministic across calls", () => {
    const depts = makeDepts(12);
    const first = computeClusterLayout(depts, STANDBY_AREA_ZONE);
    const second = computeClusterLayout(depts, STANDBY_AREA_ZONE);
    expect(first).toEqual(second);
  });

  it("clusters span the full width of the standby zone (no center clumping)", () => {
    const clusters = computeClusterLayout(makeDepts(12), STANDBY_AREA_ZONE);
    const minX = Math.min(...clusters.map((c) => c.originX));
    const maxX = Math.max(...clusters.map((c) => c.originX));
    const zoneWidth = STANDBY_AREA_ZONE.maxX - STANDBY_AREA_ZONE.minX;
    // Clusters should span at least 60% of zone width
    expect(maxX - minX).toBeGreaterThan(zoneWidth * 0.6);
  });

  it("clusters span the full height of the standby zone", () => {
    const clusters = computeClusterLayout(makeDepts(12), STANDBY_AREA_ZONE);
    const minY = Math.min(...clusters.map((c) => c.originY));
    const maxY = Math.max(...clusters.map((c) => c.originY));
    const zoneHeight = STANDBY_AREA_ZONE.maxY - STANDBY_AREA_ZONE.minY;
    // Clusters should span at least 50% of zone height
    expect(maxY - minY).toBeGreaterThan(zoneHeight * 0.5);
  });

  it("handles fewer than 12 departments gracefully", () => {
    const clusters = computeClusterLayout(makeDepts(5), STANDBY_AREA_ZONE);
    expect(clusters).toHaveLength(5);
    for (const c of clusters) {
      expect(c.originX).toBeGreaterThanOrEqual(STANDBY_AREA_ZONE.minX);
      expect(c.originY).toBeGreaterThanOrEqual(STANDBY_AREA_ZONE.minY);
    }
  });

  it("handles empty department list gracefully", () => {
    const clusters = computeClusterLayout([], STANDBY_AREA_ZONE);
    expect(clusters).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// R2 — resolveStandbyTarget agent spacing
// ---------------------------------------------------------------------------

describe("resolveStandbyTarget — agent spacing within clusters", () => {
  it("two agents in same department have different positions (≥80px apart)", () => {
    const depts = [{ department: "dept-1", departmentName: "Department 1" }];
    const agents = [
      { id: "a1", department: "dept-1", departmentName: "Department 1" },
      { id: "a2", department: "dept-1", departmentName: "Department 1" },
    ];

    const p1 = resolveStandbyTarget("a1", "dept-1", agents, STANDBY_AREA_ZONE);
    const p2 = resolveStandbyTarget("a2", "dept-1", agents, STANDBY_AREA_ZONE);

    const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    // AGENT_SLOT_W/H = 90 — agents must be at least 80px apart to avoid label collision
    expect(dist).toBeGreaterThanOrEqual(80);
  });

  it("agents from different departments are in different cluster positions", () => {
    const agents = [
      { id: "a1", department: "dept-1", departmentName: "Dept 1" },
      { id: "a2", department: "dept-2", departmentName: "Dept 2" },
    ];

    const p1 = resolveStandbyTarget("a1", "dept-1", agents, STANDBY_AREA_ZONE);
    const p2 = resolveStandbyTarget("a2", "dept-2", agents, STANDBY_AREA_ZONE);

    // Different departments → different cluster areas → non-trivial distance
    const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    expect(dist).toBeGreaterThan(0);
  });

  it("position is stable across multiple calls (no jitter)", () => {
    const agents = [
      { id: "a1", department: "dept-1", departmentName: "Dept 1" },
    ];
    const p1 = resolveStandbyTarget("a1", "dept-1", agents, STANDBY_AREA_ZONE);
    const p2 = resolveStandbyTarget("a1", "dept-1", agents, STANDBY_AREA_ZONE);
    expect(p1).toEqual(p2);
  });

  it("resolved position is within standby zone bounds", () => {
    const agents = [{ id: "a1", department: "dept-1", departmentName: "Dept 1" }];
    const p = resolveStandbyTarget("a1", "dept-1", agents, STANDBY_AREA_ZONE);
    expect(p.x).toBeGreaterThanOrEqual(STANDBY_AREA_ZONE.minX);
    expect(p.x).toBeLessThanOrEqual(STANDBY_AREA_ZONE.maxX);
    expect(p.y).toBeGreaterThanOrEqual(STANDBY_AREA_ZONE.minY);
    expect(p.y).toBeLessThanOrEqual(STANDBY_AREA_ZONE.maxY);
  });
});

// ---------------------------------------------------------------------------
// R4 — stripGymQaFurniture
// ---------------------------------------------------------------------------

describe("stripGymQaFurniture — R4 furniture migration", () => {
  it("removes all gym equipment types", () => {
    const gymTypes = [
      "treadmill",
      "weight_bench",
      "dumbbell_rack",
      "exercise_bike",
      "punching_bag",
      "rowing_machine",
      "kettlebell_rack",
      "yoga_mat",
    ];
    const items = gymTypes.map((t) => makeFurniture(t, `uid-${t}`));
    const result = stripGymQaFurniture(items);
    expect(result).toHaveLength(0);
  });

  it("removes all QA lab equipment types", () => {
    const qaTypes = ["qa_terminal", "device_rack", "test_bench"];
    const items = qaTypes.map((t) => makeFurniture(t, `uid-${t}`));
    const result = stripGymQaFurniture(items);
    expect(result).toHaveLength(0);
  });

  it("keeps non-gym/QA furniture intact", () => {
    const keepTypes = ["desk_cubicle", "chair", "plant", "server_rack", "wall", "pingpong"];
    const items = keepTypes.map((t) => makeFurniture(t, `uid-${t}`));
    const result = stripGymQaFurniture(items);
    expect(result).toHaveLength(keepTypes.length);
    expect(result.map((i) => i.type)).toEqual(keepTypes);
  });

  it("strips gym/QA while keeping normal furniture in mixed layout", () => {
    const items: FurnitureItem[] = [
      makeFurniture("desk_cubicle", "d1"),
      makeFurniture("treadmill", "g1"),
      makeFurniture("chair", "c1"),
      makeFurniture("qa_terminal", "q1"),
      makeFurniture("plant", "p1"),
      makeFurniture("test_bench", "q2"),
      makeFurniture("server_rack", "s1"),
    ];
    const result = stripGymQaFurniture(items);
    const types = result.map((i) => i.type);
    expect(types).toContain("desk_cubicle");
    expect(types).toContain("chair");
    expect(types).toContain("plant");
    expect(types).toContain("server_rack");
    expect(types).not.toContain("treadmill");
    expect(types).not.toContain("qa_terminal");
    expect(types).not.toContain("test_bench");
    expect(result).toHaveLength(4);
  });

  it("is idempotent — running twice gives same result", () => {
    const items: FurnitureItem[] = [
      makeFurniture("desk_cubicle", "d1"),
      makeFurniture("treadmill", "g1"),
      makeFurniture("qa_terminal", "q1"),
    ];
    const once = stripGymQaFurniture(items);
    const twice = stripGymQaFurniture(once);
    expect(twice).toEqual(once);
  });

  it("returns an empty array for an empty input", () => {
    expect(stripGymQaFurniture([])).toEqual([]);
  });

  it("GYM_QA_FURNITURE_TYPES contains all expected types", () => {
    const expectedGym = [
      "treadmill", "weight_bench", "dumbbell_rack", "exercise_bike",
      "punching_bag", "rowing_machine", "kettlebell_rack", "yoga_mat",
    ];
    const expectedQa = ["qa_terminal", "device_rack", "test_bench"];
    for (const t of [...expectedGym, ...expectedQa]) {
      expect(GYM_QA_FURNITURE_TYPES.has(t)).toBe(true);
    }
  });
});
