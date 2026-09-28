#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const path = resolve("docs/backlog.json");
const data = JSON.parse(readFileSync(path, "utf8"));
const cmd = process.argv[2] ?? "status";

function tasks() {
  return data.tasks;
}

if (cmd === "status") {
  const bySprint = {};
  for (const t of tasks()) {
    bySprint[t.sprint] ??= { done: 0, todo: 0 };
    bySprint[t.sprint][t.status === "done" ? "done" : "todo"] += 1;
  }
  console.log(`Silverleaf workbot · sprint ${data.meta.currentSprint}`);
  for (const [sprint, counts] of Object.entries(bySprint)) {
    console.log(`  sprint ${sprint}: ${counts.done} done / ${counts.todo} open`);
  }
  const next = tasks().find((t) => t.status !== "done");
  console.log(next ? `Next: ${next.id} ${next.title}` : "All 48 tasks done.");
} else if (cmd === "next") {
  const next = tasks().find((t) => t.status !== "done");
  if (!next) {
    console.log("No open tasks.");
    process.exit(0);
  }
  console.log(`${next.id}\n${next.title}\nSprint ${next.sprint} · owner ${next.owner}`);
  console.log("Acceptance:");
  for (const line of next.acceptance) console.log(`- ${line}`);
} else if (cmd === "done") {
  const id = process.argv[3];
  const task = tasks().find((t) => t.id === id);
  if (!task) {
    console.error("Unknown task");
    process.exit(1);
  }
  task.status = "done";
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  console.log(`Marked ${id} done`);
} else {
  console.log("usage: node scripts/workbot.mjs status|next|done TASK-00N");
}
