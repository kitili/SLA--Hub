import { format } from "date-fns";
import type { DailyPlanItem, Task, TaskStatus, User } from "@/generated/prisma/client";

const STATUS_ICON: Record<TaskStatus, string> = {
  BACKLOG: "📥",
  TODO: "📌",
  IN_PROGRESS: "🔄",
  IN_REVIEW: "👀",
  COMPLETED: "✅",
  BLOCKED: "⚠️",
  CANCELLED: "❌",
};

export function formatDailyPlanSummary(
  user: Pick<User, "name" | "phone">,
  planDate: Date,
  items: DailyPlanItem[],
): string {
  const completed = items.filter((i) => i.status === "COMPLETED").length;
  const blocked = items.filter((i) => i.status === "BLOCKED").length;
  const name = user.name ?? user.phone;

  const lines = items
    .sort((a, b) => a.slot - b.slot)
    .map((item) => {
      const icon = STATUS_ICON[item.status];
      const note = item.blockerNote ? ` — ${item.blockerNote}` : "";
      return `${item.slot}. ${icon} ${item.title}${note}`;
    });

  return [
    `📋 *Daily 5 — ${name}*`,
    `📅 ${format(planDate, "EEE d MMM yyyy")}`,
    `Progress: ${completed}/5 done${blocked ? ` | ${blocked} blocked` : ""}`,
    "",
    ...lines,
  ].join("\n");
}

export function formatBacklogSummary(tasks: Task[]): string {
  if (tasks.length === 0) {
    return "📥 *Backlog*\nNo items yet. Add with:\n`backlog add: your task`";
  }

  const lines = tasks.slice(0, 15).map((task, index) => {
    return `${index + 1}. ${STATUS_ICON[task.status]} ${task.title}`;
  });

  return ["📥 *Backlog*", ...lines].join("\n");
}

export function formatHelpMessage(): string {
  return [
    "🤖 *Daily5 Bot — Commands*",
    "",
    "*Morning*",
    "`daily task1 | task2 | task3 | task4 | task5`",
    "or numbered list after `daily:`",
    "",
    "*During the day*",
    "`done 1 3 5` — mark slots complete",
    "`start 2` — mark in progress",
    "`block 3 — waiting on finance`",
    "`status` — today's list",
    "",
    "*Backlog*",
    "`backlog add: Fix server migration`",
    "`backlog` — list backlog",
    "",
    "*Projects*",
    "`update ProjectName: task title completed`",
  ].join("\n");
}

export function formatTeamDigest(
  entries: Array<{
    userName: string;
    completed: number;
    blocked: number;
    total: number;
  }>,
): string {
  const lines = entries.map((entry) => {
    return `• ${entry.userName}: ${entry.completed}/${entry.total} done${entry.blocked ? ` (${entry.blocked} blocked)` : ""}`;
  });

  return ["📊 *Team Daily Digest*", ...lines].join("\n");
}
