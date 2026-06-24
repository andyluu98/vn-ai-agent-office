// server/claude-code-adapter/agent-registry.js
// Mutable in-memory registry of Claude agents.
// Seeded from a static roster; runtime agents can be added/removed.
// Cap and idle-prune (TTL) keep the registry bounded.
// All time logic uses an injected `now` parameter (number ms) for testability.
"use strict";

const DEFAULT_MAX_AGENTS = 5;
const DEFAULT_TTL_MS = 1_800_000; // 30 minutes

/**
 * createRegistry({ seed, maxAgents, ttlMs }) -> registry
 *
 * seed      – Array of agent descriptor objects (will be marked seed:true)
 * maxAgents – Hard cap on total agent count (default 5)
 * ttlMs     – Idle TTL for non-seed agents in milliseconds (default 30 min)
 */
function createRegistry({ seed = [], maxAgents = DEFAULT_MAX_AGENTS, ttlMs = DEFAULT_TTL_MS } = {}) {
  // Normalise seed entries: ensure required fields, mark seed:true
  const agents = seed.map((a, i) => ({
    id: a.id || `seed-${i + 1}`,
    name: a.name || a.role || `Agent ${i + 1}`,
    role: a.role || a.name || `Agent${i + 1}`,
    emoji: a.emoji || "🤖",
    system: a.system || `You are the ${a.name || a.role} agent.`,
    seed: true,
    lastActive: 0, // seeds are never pruned regardless of this value
  }));

  let nextId = 1;

  /** Return a shallow copy of the current agent list. */
  function list() {
    return agents.slice();
  }

  /**
   * Add a new agent.
   * @param {{ id?, name, role, system?, emoji? }} descriptor
   * @param {number} now  - current timestamp (ms)
   * @returns {{ ok: true, agent: object } | { ok: false, reason: 'cap'|'dup' }}
   */
  function add(descriptor, now) {
    if (agents.length >= maxAgents) {
      return { ok: false, reason: "cap" };
    }
    const role = descriptor.role || descriptor.name || `Agent${nextId}`;
    if (agents.some((a) => a.role === role)) {
      return { ok: false, reason: "dup" };
    }
    const agent = {
      id: descriptor.id || `runtime-${nextId++}`,
      name: descriptor.name || role,
      role,
      emoji: descriptor.emoji || "🤖",
      system: descriptor.system || `You are the ${role} agent in a virtual office.`,
      seed: false,
      lastActive: now,
    };
    agents.push(agent);
    return { ok: true, agent };
  }

  /**
   * Remove an agent by id (any agent — seed or runtime).
   * pruneIdle never removes seeds; this explicit call can.
   * @returns {boolean} true if found and removed
   */
  function remove(id) {
    const idx = agents.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    agents.splice(idx, 1);
    return true;
  }

  /**
   * Update lastActive for the agent matching `roleOrId`.
   * Checks role first, then id.
   * @param {string} roleOrId
   * @param {number} now
   */
  function touch(roleOrId, now) {
    const agent = agents.find((a) => a.role === roleOrId || a.id === roleOrId);
    if (agent) agent.lastActive = now;
  }

  /**
   * Remove non-seed agents whose lastActive is older than ttlMs relative to `now`.
   * Seeds are never pruned regardless of their lastActive.
   * @param {number} now
   * @returns {string[]} array of removed agent roles
   */
  function pruneIdle(now) {
    const removed = [];
    for (let i = agents.length - 1; i >= 0; i--) {
      const a = agents[i];
      if (!a.seed && now - a.lastActive > ttlMs) {
        removed.push(a.role);
        agents.splice(i, 1);
      }
    }
    return removed;
  }

  /**
   * Find the first agent whose role matches (case-sensitive).
   * @param {string} role
   * @returns {object|undefined}
   */
  function findByRole(role) {
    return agents.find((a) => a.role === role);
  }

  return { list, add, remove, touch, pruneIdle, findByRole };
}

module.exports = { createRegistry };
