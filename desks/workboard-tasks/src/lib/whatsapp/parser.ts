export type ParsedCommand =
  | { type: "daily"; tasks: string[] }
  | { type: "done"; slots: number[] }
  | { type: "start"; slots: number[] }
  | { type: "block"; slot: number; note?: string }
  | { type: "backlog_add"; title: string }
  | { type: "backlog_list" }
  | { type: "status" }
  | { type: "help" }
  | { type: "project_update"; project: string; title: string; status: "completed" | "in_progress" | "backlog" }
  | { type: "unknown"; raw: string };

function parseSlots(input: string): number[] {
  return [...new Set(
    input
      .split(/[\s,]+/)
      .map((part) => Number.parseInt(part, 10))
      .filter((n) => n >= 1 && n <= 5),
  )].sort((a, b) => a - b);
}

function parseDailyTasks(body: string): string[] {
  const withoutPrefix = body.replace(/^daily\s*:?\s*/i, "").trim();
  if (!withoutPrefix) return [];

  if (withoutPrefix.includes("|")) {
    return withoutPrefix
      .split("|")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 5);
  }

  const numbered = [...withoutPrefix.matchAll(/^\s*(\d)[.)]\s*(.+)$/gm)].map((m) => m[2].trim());
  if (numbered.length >= 1) {
    return numbered.slice(0, 5);
  }

  const lines = withoutPrefix
    .split("\n")
    .map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean);

  if (lines.length >= 1) {
    return lines.slice(0, 5);
  }

  return withoutPrefix
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export function parseIncomingMessage(body: string): ParsedCommand {
  const text = body.trim();
  const lower = text.toLowerCase();

  if (!text) {
    return { type: "unknown", raw: text };
  }

  if (["help", "menu", "commands"].includes(lower)) {
    return { type: "help" };
  }

  if (lower === "status" || lower === "my status" || lower === "today") {
    return { type: "status" };
  }

  if (lower === "backlog" || lower === "backlog list") {
    return { type: "backlog_list" };
  }

  if (lower.startsWith("daily")) {
    const tasks = parseDailyTasks(text);
    if (tasks.length === 0) {
      return { type: "unknown", raw: text };
    }
    return { type: "daily", tasks };
  }

  const doneMatch = lower.match(/^done(?:\s+(.+))?$/i);
  if (doneMatch) {
    const slots = doneMatch[1] ? parseSlots(doneMatch[1]) : [1, 2, 3, 4, 5];
    return { type: "done", slots };
  }

  const startMatch = lower.match(/^start(?:\s+(.+))?$/i);
  if (startMatch && startMatch[1]) {
    return { type: "start", slots: parseSlots(startMatch[1]) };
  }

  const blockMatch = text.match(/^block\s+(\d)(?:\s*[:\-—]\s*(.+))?$/i);
  if (blockMatch) {
    return {
      type: "block",
      slot: Number.parseInt(blockMatch[1], 10),
      note: blockMatch[2]?.trim(),
    };
  }

  const backlogAddMatch = text.match(/^backlog\s+add\s*[:\-—]?\s*(.+)$/i);
  if (backlogAddMatch) {
    return { type: "backlog_add", title: backlogAddMatch[1].trim() };
  }

  const projectUpdateMatch = text.match(
    /^update\s+([^:]+):\s*(.+?)\s+(completed|done|in progress|in_progress|backlog)$/i,
  );
  if (projectUpdateMatch) {
    const statusRaw = projectUpdateMatch[3].toLowerCase();
    const status =
      statusRaw === "completed" || statusRaw === "done"
        ? "completed"
        : statusRaw === "backlog"
          ? "backlog"
          : "in_progress";

    return {
      type: "project_update",
      project: projectUpdateMatch[1].trim(),
      title: projectUpdateMatch[2].trim(),
      status,
    };
  }

  return { type: "unknown", raw: text };
}
