// server/claude-code-adapter/execution-loop.js
// Sequential execution loop: for each decomposed task, resolve agent → upsert
// todo → in_progress → call runner → done (or blocked on error).
// All dependencies are injected for full TDD coverage.
"use strict";

const MAX_NOTE_LENGTH = 2000;

/**
 * Run a list of decomposed tasks sequentially.
 * For each task:
 *   1. Resolve agent by role (fallback: first in registry).
 *   2. Build TaskBoardCard, upsert with status "todo".
 *   3. Set status "in_progress", upsert.
 *   4. Call runner with task prompt + agent system.
 *   5. On success: status "done", append result note, upsert.
 *      On isError or throw: status "blocked", note the error, upsert. No retry.
 *
 * @param {{
 *   tasks:    Array<{title:string, description:string, role:string}>,
 *   registry: { list: () => object[], findByRole: (role:string) => object|undefined },
 *   runner:   (opts:{prompt:string, system:string, model:string}) => Promise<{text:string,isError:boolean}>,
 *   model:    string,
 *   upsert:   (task:object) => Promise<object>,
 *   now:      () => number,
 *   maxTasks?: number,
 * }} opts
 * @returns {Promise<Array<{id:string, status:string, role:string}>>}
 */
async function runTasks({ tasks, registry, runner, model, upsert, now, maxTasks = 8 }) {
  const capped = tasks.slice(0, maxTasks);
  const results = [];

  for (let index = 0; index < capped.length; index++) {
    const task = capped[index];
    const ts = now();
    const id = `task-${ts}-${index}`;

    // Resolve agent: by role first, then fall back to first in registry
    const agent = registry.findByRole(task.role) || registry.list()[0];
    const assignedAgentId = agent ? agent.role : null;

    // Build the base card
    const card = {
      id,
      title: task.title,
      description: task.description,
      status: "todo",
      source: "claw3d_manual",
      assignedAgentId,
      notes: [],
    };

    // 1. Persist as todo
    await upsert({ ...card });

    // 2. Mark in_progress
    card.status = "in_progress";
    await upsert({ ...card });

    // 3. Run the agent
    try {
      const result = await runner({
        prompt: `${task.title}\n\n${task.description}`,
        system: agent ? agent.system : undefined,
        model,
      });

      if (result && result.isError) {
        // Runner returned an error response — mark blocked
        const note = String(result.text || "Agent returned an error").slice(0, MAX_NOTE_LENGTH);
        card.status = "blocked";
        card.notes = [note];
        await upsert({ ...card });
        results.push({ id, status: "blocked", role: task.role });
      } else {
        // Success — append result text as note
        const note = String((result && result.text) || "").slice(0, MAX_NOTE_LENGTH);
        card.status = "done";
        card.notes = note ? [note] : [];
        await upsert({ ...card });
        results.push({ id, status: "done", role: task.role });
      }
    } catch (err) {
      // Runner threw — mark blocked, record error message
      const note = (err && err.message ? err.message : String(err)).slice(0, MAX_NOTE_LENGTH);
      card.status = "blocked";
      card.notes = [note];
      await upsert({ ...card });
      results.push({ id, status: "blocked", role: task.role });
    }
  }

  return results;
}

module.exports = { runTasks };
