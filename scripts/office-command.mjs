#!/usr/bin/env node
// scripts/office-command.mjs
// CLI: post a goal to the Claude Code adapter's /command endpoint.
// Usage: node scripts/office-command.mjs "Your goal here"
//        npm run office-command "Your goal here"

const PORT = process.env.CLAUDE_ADAPTER_PORT || 7770;
const BASE = `http://127.0.0.1:${PORT}`;

const goal = process.argv.slice(2).join(" ").trim();

if (!goal) {
  console.error("Usage: npm run office-command \"<your goal>\"");
  console.error("Example: npm run office-command \"Lập kế hoạch landing page bán khóa học AI\"");
  process.exit(1);
}

console.log(`\nSending goal to adapter at ${BASE}/command …`);
console.log(`Goal: ${goal}\n`);

let res;
try {
  res = await fetch(`${BASE}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal }),
  });
} catch (err) {
  console.error(`\nCould not reach adapter at ${BASE}.`);
  console.error("Make sure it is running: npm run claude-adapter");
  console.error(`Error: ${err.message}`);
  process.exit(1);
}

let data;
try {
  data = await res.json();
} catch {
  console.error(`Unexpected response (status ${res.status}) — could not parse JSON.`);
  process.exit(1);
}

if (!res.ok) {
  console.error(`Adapter returned ${res.status}: ${data.error || JSON.stringify(data)}`);
  process.exit(1);
}

console.log(`Created ${data.created} task(s):`);
if (Array.isArray(data.tasks)) {
  data.tasks.forEach((title, i) => console.log(`  ${i + 1}. ${title}`));
}
console.log(`\nExecution loop running in background — tasks updating on the Kanban board.`);
console.log(`View the board: http://localhost:3000  (open the Kanban tab in the office)`);
