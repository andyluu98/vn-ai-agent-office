// Who "comments from outside" during a meeting. When a department's head sits in
// the meeting room, that department's other members stay at their station but
// show a speech bubble — so the user sees the whole department weighing in.

export type AgentDept = { id: string; department?: string | null };

// Generic Vietnamese "góp ý" lines; assigned deterministically per agent id so a
// given agent always says the same thing (no real per-member text exists mid-meeting).
const COMMENT_LINES = [
  "Em góp ý chỗ này ạ…",
  "Cân nhắc kỹ ngân sách nhé.",
  "Nhất trí với sếp.",
  "Cần thêm dữ liệu thị trường.",
  "Em hơi lo về tiến độ.",
  "Thử kênh mới xem sao?",
  "Khách hàng sẽ thích cái này.",
  "Rà lại rủi ro đã sếp.",
  "Em lo phần chi phí vận hành.",
  "Đề xuất ưu tiên việc này trước.",
];

const hashId = (id: string): number => {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
};

/** Stable comment line for an agent id. */
export const commentLineFor = (agentId: string): string =>
  COMMENT_LINES[hashId(agentId) % COMMENT_LINES.length];

/**
 * Given the meeting participants (heads, in the room) and the full agent list,
 * find the departments currently meeting and the OTHER members of those
 * departments who should comment from their desk.
 */
export const computeMeetingCommenters = (
  participantIds: Set<string> | string[],
  agents: AgentDept[],
): { meetingDepartments: string[]; commenterIds: string[] } => {
  const participants =
    participantIds instanceof Set ? participantIds : new Set(participantIds);
  const meetingDepartments = new Set<string>();
  for (const a of agents) {
    const dept = (a.department || "").trim();
    if (dept && participants.has(a.id)) meetingDepartments.add(dept);
  }
  const commenterIds: string[] = [];
  for (const a of agents) {
    const dept = (a.department || "").trim();
    if (!dept || participants.has(a.id)) continue;
    if (meetingDepartments.has(dept)) commenterIds.push(a.id);
  }
  return { meetingDepartments: [...meetingDepartments], commenterIds };
};

/** Map of commenter agent id → speech line. */
export const buildDeskComments = (
  participantIds: Set<string> | string[],
  agents: AgentDept[],
): Record<string, string> => {
  const { commenterIds } = computeMeetingCommenters(participantIds, agents);
  const out: Record<string, string> = {};
  for (const id of commenterIds) out[id] = commentLineFor(id);
  return out;
};
