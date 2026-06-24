// server/claude-code-adapter/task-store-client.js
// Node helper to talk to the Studio task store API.
// Base URL: OFFICE_STUDIO_URL env (default http://localhost:3000).
// All functions accept an optional fetchImpl for test injection (default: global fetch).
"use strict";

const BASE_URL = (process.env.OFFICE_STUDIO_URL || "http://localhost:3000").replace(/\/$/, "");

/**
 * Upsert a task card into the shared task store.
 * PUT {base}/api/task-store  body: { task }
 *
 * @param {Record<string,unknown>} task  - task object (must have id + title)
 * @param {typeof fetch} [fetchImpl]     - injectable fetch for tests
 * @returns {Promise<Record<string,unknown>>} the upserted task
 */
async function upsertTask(task, fetchImpl) {
  const fetcher = fetchImpl || fetch;
  const res = await fetcher(`${BASE_URL}/api/task-store`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task }),
  });
  if (!res.ok) {
    // I-2: renamed from `text` — variable holds parsed JSON body, not raw text.
    const errBody = await res.json().catch(() => ({}));
    throw new Error(`task-store upsert failed (${res.status}): ${JSON.stringify(errBody)}`);
  }
  const data = await res.json();
  return data.task ?? task;
}

/**
 * List all tasks from the shared task store.
 * GET {base}/api/task-store  → { tasks: [...] }
 *
 * @param {typeof fetch} [fetchImpl]  - injectable fetch for tests
 * @returns {Promise<Record<string,unknown>[]>}
 */
async function listTasks(fetchImpl) {
  const fetcher = fetchImpl || fetch;
  const res = await fetcher(`${BASE_URL}/api/task-store`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    // I-2: consistent naming — errBody holds parsed JSON error, not raw text.
    const errBody = await res.json().catch(() => ({}));
    throw new Error(`task-store list failed (${res.status}): ${JSON.stringify(errBody)}`);
  }
  const data = await res.json();
  return Array.isArray(data.tasks) ? data.tasks : [];
}

module.exports = { upsertTask, listTasks };
