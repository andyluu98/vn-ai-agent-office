// server/claude-code-adapter/discussion.js
// Multi-round discussion phase: after /command tasks finish, if ≥2 agents
// participated, they discuss turn-by-turn and Orchestrator synthesizes a conclusion.
// All dependencies are injected for full TDD coverage.
"use strict";

const MAX_TRANSCRIPT_LENGTH = 6000;
const MAX_CARD_TITLE_LENGTH = 140;
const DEFAULT_ROUNDS = 2;
const DEFAULT_TURN_MS = 2500;
const DEFAULT_MAX_PARTICIPANTS = 4;

const SYNTHESIS_SYSTEM =
  "Bạn là trưởng cuộc họp. Dựa trên toàn bộ nội dung thảo luận, " +
  "hãy tổng hợp quyết định và các bước tiếp theo trong 3-5 câu bằng tiếng Việt. " +
  "Trả lời ngắn gọn, rõ ràng, tập trung vào kết quả hành động.";

/**
 * Truncate a string, appending "…" if cut.
 * @param {string} s
 * @param {number} max
 * @returns {string}
 */
function trunc(s, max) {
  const str = String(s || "");
  return str.length <= max ? str : str.slice(0, max - 1) + "…";
}

/**
 * Append a line to transcript, capping total length by dropping oldest content.
 * @param {string} transcript
 * @param {string} line
 * @returns {string}
 */
function appendTranscript(transcript, line) {
  const next = transcript ? transcript + "\n" + line : line;
  if (next.length <= MAX_TRANSCRIPT_LENGTH) return next;
  // Keep the tail (most recent content)
  return next.slice(next.length - MAX_TRANSCRIPT_LENGTH);
}

/**
 * Seed transcript from task results.
 * @param {Array<{role:string, title?:string, note?:string}>} taskResults
 * @returns {string}
 */
function seedTranscript(taskResults) {
  if (!Array.isArray(taskResults) || taskResults.length === 0) return "";
  const lines = taskResults.map((r) => {
    const role = String(r.role || "?");
    const title = r.title ? String(r.title) : "";
    const note = r.note ? trunc(String(r.note), 300) : "";
    return title ? `${role} (${title}): ${note}` : `${role}: ${note}`;
  });
  return lines.join("\n");
}

/**
 * Build a collision-safe meeting card id for a participant.
 * Stable for the same participant within one discussion (seeded by nowTs).
 * @param {string} role
 * @param {number} nowTs
 * @returns {string}
 */
function meetingCardId(role, nowTs) {
  // Sanitize role into a safe slug (alphanumeric + dash)
  const slug = role.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `meeting-${nowTs}-${slug}`;
}

/**
 * Run the multi-round discussion phase.
 *
 * @param {{
 *   goal:            string,
 *   participants:    string[],
 *   taskResults:     Array<{id:string, status:string, role:string, title?:string, note?:string}>,
 *   registry:        { list:()=>object[], findByRole:(role:string)=>object|undefined },
 *   runner:          (opts:{prompt:string, system?:string, model:string}) => Promise<{text:string, isError:boolean}>,
 *   model:           string,
 *   upsert:          (task:object) => Promise<object>,
 *   sleep?:          (ms:number) => Promise<void>,
 *   now?:            () => number,
 *   rounds?:         number,
 *   turnMs?:         number,
 *   maxParticipants?: number,
 * }} opts
 * @returns {Promise<{rounds:number, turns:number, synthesis:string}|null>}
 */
async function runDiscussion({
  goal,
  participants,
  taskResults,
  registry,
  runner,
  model,
  upsert,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  now = () => Date.now(),
  rounds = DEFAULT_ROUNDS,
  turnMs = DEFAULT_TURN_MS,
  maxParticipants = DEFAULT_MAX_PARTICIPANTS,
}) {
  // Guard: need at least 2 distinct participants to have a discussion
  if (!Array.isArray(participants) || participants.length < 2) return null;

  // Cap participants
  const capped = participants.slice(0, maxParticipants);
  const nowTs = now();

  // Build stable card ids per participant (reused across all rounds)
  const cardIds = {};
  for (const role of capped) {
    cardIds[role] = meetingCardId(role, nowTs);
  }

  // Create initial in_progress meeting cards for all participants
  for (const role of capped) {
    await upsert({
      id: cardIds[role],
      title: "Đang họp…",
      status: "in_progress",
      source: "claw3d_manual",
      assignedAgentId: role,
    });
  }

  // Seed transcript from task results
  let transcript = seedTranscript(taskResults);

  const log = [];

  // Discussion rounds
  for (let round = 1; round <= rounds; round++) {
    for (const role of capped) {
      // Signal this participant is about to speak
      await upsert({
        id: cardIds[role],
        title: "(đang phát biểu…)",
        status: "in_progress",
        source: "claw3d_manual",
        assignedAgentId: role,
      });

      const agent = registry.findByRole(role);
      const agentSystem = agent ? agent.system : undefined;

      const prompt =
        `Mục tiêu cuộc thảo luận: ${goal}\n\n` +
        `Nội dung thảo luận đến hiện tại:\n${transcript || "(chưa có)"}\n\n` +
        `Bạn là ${role}. Góp ý/phản biện ngắn gọn 2-3 câu dựa trên thảo luận trên.`;

      let line;
      try {
        const result = await runner({ prompt, system: agentSystem, model });
        if (result && result.isError) {
          line = null;
          log.push(`(lượt của ${role} bị gián đoạn: ${trunc(String(result.text || "isError"), 200)})`);
        } else {
          line = String((result && result.text) || "").trim();
          log.push(`${role}: ${line}`);
          transcript = appendTranscript(transcript, `${role}: ${line}`);
        }
      } catch (err) {
        line = null;
        const msg = (err && err.message) ? err.message : String(err);
        log.push(`(lượt của ${role} bị gián đoạn: ${trunc(msg, 200)})`);
      }

      // Update card with the spoken line (or silence marker on error)
      const cardTitle = line ? trunc(line, MAX_CARD_TITLE_LENGTH) : "(im lặng)";
      await upsert({
        id: cardIds[role],
        title: cardTitle,
        status: "in_progress",
        source: "claw3d_manual",
        assignedAgentId: role,
      });

      // Delay so office poll can render this speaker's bubble
      await sleep(turnMs);
    }
  }

  // Synthesis: call runner with full transcript, using a meeting-lead system
  const synthesisPrompt =
    `Mục tiêu: ${goal}\n\n` +
    `Nội dung thảo luận:\n${transcript || "(không có)"}\n\n` +
    `Hãy tổng hợp quyết định và các bước tiếp theo.`;

  let synthesis = "";
  try {
    const synthResult = await runner({
      prompt: synthesisPrompt,
      system: SYNTHESIS_SYSTEM,
      model,
    });
    synthesis = (synthResult && !synthResult.isError)
      ? String(synthResult.text || "").trim()
      : `(tổng hợp thất bại: ${trunc(String((synthResult && synthResult.text) || ""), 200)})`;
  } catch (err) {
    synthesis = `(tổng hợp thất bại: ${trunc((err && err.message) ? err.message : String(err), 200)})`;
  }

  // Write conclusion card
  const conclusionId = `meeting-conclusion-${nowTs}`;
  await upsert({
    id: conclusionId,
    title: trunc(`📋 Kết luận cuộc họp: ${goal}`, MAX_CARD_TITLE_LENGTH),
    description: goal,
    status: "done",
    source: "claw3d_manual",
    assignedAgentId: capped[0],
    notes: [synthesis],
  });

  // Set all participant meeting cards to done
  for (const role of capped) {
    await upsert({
      id: cardIds[role],
      title: "Đã họp xong",
      status: "done",
      source: "claw3d_manual",
      assignedAgentId: role,
    });
  }

  return { rounds, turns: log.length, synthesis };
}

module.exports = { runDiscussion };
