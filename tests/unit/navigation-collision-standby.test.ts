import { describe, expect, it } from "vitest";

import { applyAgentCollisionBumps } from "@/features/retro-office/systems/NavigationSystem";
import type { RenderAgent } from "@/features/retro-office/core/types";

/** Minimal OfficeAgent fixture — only fields applyAgentCollisionBumps reads. */
function makeAgent(
  overrides: Partial<RenderAgent> & Pick<RenderAgent, "id" | "x" | "y">,
): RenderAgent {
  return {
    name: overrides.id,
    status: "working",
    color: "#fff",
    item: "laptop",
    state: "walking",
    targetX: overrides.x,
    targetY: overrides.y,
    path: [],
    facing: 0,
    frame: 0,
    walkSpeed: 1,
    phaseOffset: 0,
    ...overrides,
  } as RenderAgent;
}

const SLOT_X = 300;
const SLOT_Y = 400;
const NOW = 1_000_000;

describe("applyAgentCollisionBumps — standby exemption", () => {
  it("does NOT redirect standby agents (their targetX/Y must stay on their standby slot)", () => {
    // Two standby agents placed exactly on top of each other → well within minDist (AGENT_RADIUS*2 = 40)
    const agents: RenderAgent[] = [
      makeAgent({
        id: "standby-a",
        x: SLOT_X,
        y: SLOT_Y,
        targetX: SLOT_X,
        targetY: SLOT_Y,
        interactionTarget: "standby",
      }),
      makeAgent({
        id: "standby-b",
        x: SLOT_X,
        y: SLOT_Y,
        targetX: SLOT_X,
        targetY: SLOT_Y,
        interactionTarget: "standby",
      }),
    ];

    const result = applyAgentCollisionBumps({ agents, now: NOW });

    // Neither standby agent should have its targetX/Y overwritten by a roam-point escape
    expect(result[0].targetX).toBe(SLOT_X);
    expect(result[0].targetY).toBe(SLOT_Y);
    expect(result[1].targetX).toBe(SLOT_X);
    expect(result[1].targetY).toBe(SLOT_Y);

    // bumpedUntil must NOT be set for standby agents
    expect(result[0].bumpedUntil).toBeUndefined();
    expect(result[1].bumpedUntil).toBeUndefined();
  });

  it("DOES redirect non-standby walking agents that overlap (regression — existing behavior preserved)", () => {
    // Two walking agents with no interactionTarget, fully overlapping
    const agents: RenderAgent[] = [
      makeAgent({
        id: "walker-a",
        x: 500,
        y: 500,
        targetX: 600,
        targetY: 600,
        state: "walking",
        interactionTarget: undefined,
      }),
      makeAgent({
        id: "walker-b",
        x: 500,
        y: 500,
        targetX: 600,
        targetY: 600,
        state: "walking",
        interactionTarget: undefined,
      }),
    ];

    const result = applyAgentCollisionBumps({ agents, now: NOW });

    // At least one agent should have been bumped (targetX/Y changed away from original 600,600)
    const aBumped =
      result[0].targetX !== 600 ||
      result[0].targetY !== 600 ||
      result[0].bumpedUntil !== undefined;
    const bBumped =
      result[1].targetX !== 600 ||
      result[1].targetY !== 600 ||
      result[1].bumpedUntil !== undefined;

    expect(aBumped || bBumped).toBe(true);
  });
});
