import { describe, it, expect } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mod = require("../../server/opc-mirror/department-agents");
const buildDepartmentRoleMap = mod.buildDepartmentRoleMap;
const agentsForDepartments = mod.agentsForDepartments;
const pickDepartmentHead = mod.pickDepartmentHead;
const headsForDepartments = mod.headsForDepartments;

const AGENTS = [
  { role: "Trưởng phòng Kinh doanh", department: "06-sales" },
  { role: "Account Manager", department: "06-sales" },
  { role: "Kế toán", department: "03-finance" },
  { role: "Giám đốc Tài chính", department: "03-finance" },
  { role: "Sáng tạo Nội dung", department: "07-marketing" },
];

describe("department-agents map", () => {
  it("groups agent roles by department code", () => {
    const map = buildDepartmentRoleMap(AGENTS);
    expect(map.get("06-sales")).toEqual(["Trưởng phòng Kinh doanh", "Account Manager"]);
    expect(map.get("03-finance")).toEqual(["Kế toán", "Giám đốc Tài chính"]);
  });

  it("flattens roles for a set of departments, deduped + stable", () => {
    const map = buildDepartmentRoleMap(AGENTS);
    const roles = agentsForDepartments(map, ["07-marketing", "03-finance"]);
    expect(roles).toEqual(["Sáng tạo Nội dung", "Kế toán", "Giám đốc Tài chính"]);
  });

  it("picks the manager role as department head, else first agent", () => {
    expect(pickDepartmentHead(["Account Manager", "Trưởng phòng Kinh doanh"])).toBe(
      "Trưởng phòng Kinh doanh",
    );
    expect(pickDepartmentHead(["Kế toán", "Giám đốc Tài chính"])).toBe("Giám đốc Tài chính");
    expect(pickDepartmentHead(["Sáng tạo Nội dung"])).toBe("Sáng tạo Nội dung");
    expect(pickDepartmentHead([])).toBe(null);
  });

  it("returns one head per department for the meeting room", () => {
    const map = buildDepartmentRoleMap(AGENTS);
    expect(headsForDepartments(map, ["06-sales", "03-finance"])).toEqual([
      "Trưởng phòng Kinh doanh",
      "Giám đốc Tài chính",
    ]);
  });

  it("ignores unknown departments and entries without role/department", () => {
    const map = buildDepartmentRoleMap([...AGENTS, { role: "", department: "06-sales" }, { role: "X" }]);
    expect(agentsForDepartments(map, ["99-nope"])).toEqual([]);
    expect(map.get("06-sales")).toEqual(["Trưởng phòng Kinh doanh", "Account Manager"]);
  });
});
