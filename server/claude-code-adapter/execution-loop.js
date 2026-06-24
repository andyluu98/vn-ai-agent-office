// server/claude-code-adapter/execution-loop.js
// Bounded-concurrency execution loop: for each decomposed task, resolve agent →
// upsert todo → in_progress → call runner → done (or blocked on error).
// All dependencies are injected for full TDD coverage.
"use strict";

const MAX_NOTE_LENGTH = 2000;

/**
 * Default sleep implementation — overridable in tests for determinism.
 * @param {number} ms
 */
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run a list of decomposed tasks through a bounded worker pool.
 *
 * Up to `concurrency` tasks are in_progress simultaneously; as one finishes
 * the next starts.  Tasks START in array order.  The returned results array
 * preserves input order regardless of completion order.
 *
 * If the runner rejects with "Too many concurrent …" (gate contention), the
 * task is retried up to `maxRetries` times before being marked blocked.
 *
 * Per-task flow (same as before):
 *   1. Resolve agent by role (fallback: first in registry).
 *   2. Build TaskBoardCard, upsert with status "todo".
 *   3. Set status "in_progress", upsert.
 *   4. Call runner with task prompt + agent system.
 *   5. On success: status "done", append result note, upsert.
 *      On isError or throw: status "blocked", note the error, upsert.
 *
 * @param {{
 *   tasks:        Array<{title:string, description:string, role:string}>,
 *   registry:     { list: () => object[], findByRole: (role:string) => object|undefined },
 *   runner:       (opts:{prompt:string, system:string, model:string}) => Promise<{text:string,isError:boolean}>,
 *   model:        string,
 *   upsert:       (task:object) => Promise<object>,
 *   now:          () => number,
 *   maxTasks?:    number,
 *   concurrency?: number,
 *   maxRetries?:  number,
 *   sleep?:       (ms:number) => Promise<void>,
 * }} opts
 * @returns {Promise<Array<{id:string, status:string, role:string, title:string, note:string}>>}
 */
async function runTasks({
  tasks,
  registry,
  runner,
  model,
  upsert,
  now,
  maxTasks = 8,
  concurrency = 3,
  maxRetries = 3,
  sleep = defaultSleep,
}) {
  const capped = tasks.slice(0, maxTasks);
  // Pre-allocate results array so index → result order is preserved.
  const results = new Array(capped.length);

  /**
   * I-3: safeUpsert — a transient store error must not abort the batch.
   */
  async function safeUpsert(data) {
    try {
      await upsert(data);
    } catch (upsertErr) {
      console.error(
        `[execution-loop] upsert failed for task ${data.id}:`,
        (upsertErr && upsertErr.message) || upsertErr,
      );
    }
  }

  /**
   * Process a single task at array index `index`.
   * Returns a result object { id, status, role }.
   */
  async function processTask(index) {
    const task = capped[index];
    const ts = now();
    // C-2: Random suffix prevents id collisions when two commands fire in the same ms.
    const id = `task-${ts}-${index}-${Math.floor(Math.random() * 1e6)}`;

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
    await safeUpsert({ ...card });

    // 2. Mark in_progress
    card.status = "in_progress";
    await safeUpsert({ ...card });

    // 3. Run the agent (with retry on gate contention)
    let attempt = 0;
    while (true) {
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
          await safeUpsert({ ...card });
          return { id, status: "blocked", role: task.role, title: task.title, note };
        }

        // Success — append result text as note
        const note = String((result && result.text) || "").slice(0, MAX_NOTE_LENGTH);
        card.status = "done";
        card.notes = note ? [note] : [];
        await safeUpsert({ ...card });
        return { id, status: "done", role: task.role, title: task.title, note };
      } catch (err) {
        const msg = (err && err.message) ? err.message : String(err);

        // Transient gate contention — retry with a small backoff before giving up.
        if (/too many concurrent/i.test(msg) && attempt < maxRetries) {
          attempt++;
          await sleep(50 * attempt); // 50 ms, 100 ms, 150 ms
          continue;
        }

        // Permanent failure — mark blocked.
        const note = msg.slice(0, MAX_NOTE_LENGTH);
        card.status = "blocked";
        card.notes = [note];
        await safeUpsert({ ...card });
        return { id, status: "blocked", role: task.role, title: task.title, note };
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Bounded worker pool: start tasks in index order, at most `concurrency`
  // active at once.  Uses a simple "slot" approach: maintain a set of running
  // promises; when one settles, start the next pending task.
  // ---------------------------------------------------------------------------
  const pool = new Set();
  let nextIndex = 0;

  /**
   * Kick off the next pending task (if any) and register it in the pool.
   * When the task finishes it removes itself from the pool and kicks the next one.
   */
  function startNext() {
    if (nextIndex >= capped.length) return;
    const index = nextIndex++;
    const promise = processTask(index).then((result) => {
      results[index] = result;
      pool.delete(promise);
      startNext();
    });
    pool.add(promise);
  }

  // Fill the pool up to `concurrency` slots initially.
  const initialSlots = Math.min(concurrency, capped.length);
  for (let i = 0; i < initialSlots; i++) {
    startNext();
  }

  // Wait until all tasks have settled.
  while (pool.size > 0) {
    // Await any one promise in the pool to make progress.
    await Promise.race(pool);
  }

  return results;
}

module.exports = { runTasks };
