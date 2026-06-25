// server/opc-mirror/department-agents.js
// Map vn-opc department codes (e.g. "07-marketing") to the office agents that
// belong to them, so a department-level meeting in opc can light up all that
// department's agents in the 3D office.

/**
 * Build { departmentCode -> [agentRole, …] } from the adapter /agents payload.
 * Each agent has { role, department }. The office uses `role` as the agent id.
 * @param {Array<{role?:string, id?:string, department?:string|null}>} agents
 * @returns {Map<string, string[]>}
 */
function buildDepartmentRoleMap(agents) {
  const map = new Map();
  for (const a of agents || []) {
    const dept = (a.department || "").trim();
    const role = (a.role || a.id || "").trim();
    if (!dept || !role) continue;
    if (!map.has(dept)) map.set(dept, []);
    const list = map.get(dept);
    if (!list.includes(role)) list.push(role);
  }
  return map;
}

/**
 * Flatten the agent roles for a set of department codes (stable, deduped).
 * @param {Map<string,string[]>} deptRoleMap
 * @param {string[]} departments
 * @returns {string[]}
 */
function agentsForDepartments(deptRoleMap, departments) {
  const out = [];
  const seen = new Set();
  for (const dept of departments || []) {
    for (const role of deptRoleMap.get(dept) || []) {
      if (!seen.has(role)) {
        seen.add(role);
        out.push(role);
      }
    }
  }
  return out;
}

/**
 * Pick the "head" of a department to sit IN the meeting room. Prefers a manager
 * role (Trưởng phòng / Giám đốc / Trưởng / Quản lý); falls back to the first agent.
 * @param {string[]} roles
 * @returns {string|null}
 */
function pickDepartmentHead(roles) {
  if (!roles || roles.length === 0) return null;
  const head = roles.find((r) => /^(Trưởng phòng|Giám đốc|Trưởng|Quản lý)/i.test(r));
  return head || roles[0];
}

/**
 * One head per department (the representative who enters the meeting room).
 * @param {Map<string,string[]>} deptRoleMap
 * @param {string[]} departments
 * @returns {string[]}
 */
function headsForDepartments(deptRoleMap, departments) {
  const out = [];
  const seen = new Set();
  for (const dept of departments || []) {
    const head = pickDepartmentHead(deptRoleMap.get(dept) || []);
    if (head && !seen.has(head)) {
      seen.add(head);
      out.push(head);
    }
  }
  return out;
}

module.exports = {
  buildDepartmentRoleMap,
  agentsForDepartments,
  pickDepartmentHead,
  headsForDepartments,
};
