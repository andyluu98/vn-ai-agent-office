import { describe, it, expect } from "vitest";
import {
  computeMeetingCommenters,
  buildDeskComments,
  commentLineFor,
} from "@/features/retro-office/core/meeting-commenters";

const AGENTS = [
  { id: "head-sales", department: "06-sales" },
  { id: "member-sales-1", department: "06-sales" },
  { id: "member-sales-2", department: "06-sales" },
  { id: "head-fin", department: "03-finance" },
  { id: "member-fin", department: "03-finance" },
  { id: "outsider", department: "07-marketing" },
];

describe("meeting commenters", () => {
  it("finds the meeting departments from participants (heads)", () => {
    const { meetingDepartments } = computeMeetingCommenters(["head-sales", "head-fin"], AGENTS);
    expect(meetingDepartments.sort()).toEqual(["03-finance", "06-sales"]);
  });

  it("commenters = other members of meeting departments, excluding participants", () => {
    const { commenterIds } = computeMeetingCommenters(["head-sales", "head-fin"], AGENTS);
    expect(commenterIds.sort()).toEqual(["member-fin", "member-sales-1", "member-sales-2"]);
  });

  it("agents in non-meeting departments do not comment", () => {
    const { commenterIds } = computeMeetingCommenters(["head-sales"], AGENTS);
    expect(commenterIds).not.toContain("outsider");
    expect(commenterIds.sort()).toEqual(["member-sales-1", "member-sales-2"]);
  });

  it("no participants → no commenters", () => {
    expect(computeMeetingCommenters([], AGENTS).commenterIds).toEqual([]);
  });

  it("buildDeskComments maps each commenter to a stable line", () => {
    const a = buildDeskComments(["head-sales"], AGENTS);
    const b = buildDeskComments(["head-sales"], AGENTS);
    expect(a).toEqual(b); // deterministic
    expect(a["member-sales-1"]).toBe(commentLineFor("member-sales-1"));
    expect(a["head-sales"]).toBeUndefined(); // participant doesn't comment from desk
    expect(typeof a["member-sales-2"]).toBe("string");
  });
});
