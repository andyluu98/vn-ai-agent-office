// TDD tests for opc-mirror vault-task-reader: derive a task's status +
// departments from the files present in a vn-opc vault task folder.
import { describe, it, expect } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mod = require("../../server/opc-mirror/vault-task-reader");
const analyzeTask: (input: {
  folderName: string;
  files: string[];
  routingText?: string;
  hasOutputs?: boolean;
}) => {
  id: string;
  title: string;
  status: string;
  departments: string[];
  meetingActive: boolean;
  hasDecisionReport: boolean;
} = mod.analyzeTask;

const ROUTING = `---
type: routing
---
# Phân loại task

- **Class:** COMPLEX
- **Departments:** 07-marketing, 03-finance, 06-sales
- **Reasoning:** abc
`;

describe("analyzeTask — status state machine", () => {
  it("brief only → created, no departments", () => {
    const r = analyzeTask({ folderName: "2026-05-08-0021-x", files: ["00-brief.md"] });
    expect(r.status).toBe("created");
    expect(r.departments).toEqual([]);
    expect(r.meetingActive).toBe(false);
  });

  it("no brief → empty (skip)", () => {
    const r = analyzeTask({ folderName: "x", files: ["README.md"] });
    expect(r.status).toBe("empty");
  });

  it("clarification without answer → awaiting_clarification", () => {
    const r = analyzeTask({
      folderName: "2026-05-08-1419-tet",
      files: ["00-brief.md", "01-routing.md", "02-context.md", "03-clarification.md"],
      routingText: ROUTING,
    });
    expect(r.status).toBe("awaiting_clarification");
    expect(r.departments).toEqual(["07-marketing", "03-finance", "06-sales"]);
  });

  it("research done, no meeting outputs yet → meeting in progress", () => {
    const r = analyzeTask({
      folderName: "2026-05-08-2011-trung-thu",
      files: ["00-brief.md", "01-routing.md", "02-context.md", "03b-research-findings.md"],
      routingText: ROUTING,
    });
    expect(r.status).toBe("meeting");
    expect(r.meetingActive).toBe(true);
    expect(r.hasDecisionReport).toBe(false);
  });

  it("decision report present, no plan → awaiting_decision (not meeting)", () => {
    const r = analyzeTask({
      folderName: "t",
      files: [
        "00-brief.md", "01-routing.md", "02-context.md", "03b-research-findings.md",
        "04-meeting-r1-perspectives.md", "05-meeting-r2-debate.md",
        "06-meeting-r3-perspectives.md", "07-decision-report.md",
      ],
      routingText: ROUTING,
    });
    expect(r.status).toBe("awaiting_decision");
    expect(r.meetingActive).toBe(false);
    expect(r.hasDecisionReport).toBe(true);
  });

  it("full pipeline 00-08 + outputs → done", () => {
    const r = analyzeTask({
      folderName: "t",
      files: [
        "00-brief.md", "01-routing.md", "02-context.md", "03b-research-findings.md",
        "04-meeting-r1-perspectives.md", "05-meeting-r2-debate.md",
        "06-meeting-r3-perspectives.md", "07-decision-report.md", "08-execution-plan.md",
      ],
      routingText: ROUTING,
      hasOutputs: true,
    });
    expect(r.status).toBe("done");
    expect(r.meetingActive).toBe(false);
  });

  it("derives a readable title from the folder name (strips date prefix)", () => {
    const r = analyzeTask({
      folderName: "2026-05-08-2011-lap-ke-hoach-marketing-trung-thu",
      files: ["00-brief.md"],
    });
    expect(r.title.toLowerCase()).toContain("ke hoach");
    expect(r.title).not.toContain("2026-05-08");
  });

  it("routing parse ignores prose, keeps only department codes", () => {
    const r = analyzeTask({
      folderName: "t",
      files: ["00-brief.md", "01-routing.md", "03b-research-findings.md"],
      routingText: ROUTING,
    });
    expect(r.departments).toEqual(["07-marketing", "03-finance", "06-sales"]);
  });
});
