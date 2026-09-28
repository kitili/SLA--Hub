import type { TaskStatus } from "@/generated/prisma/client";

export type BoardColumn = {
  id: TaskStatus;
  title: string;
  color: string;
  card: string;
  pill: string;
};

/** Four stacks, left to right — today's tasks, then progress, holding, and done. */
export const BOARD_COLUMNS: BoardColumn[] = [
  {
    id: "TODO",
    title: "Tasks",
    color: "border-[#80BFEC] bg-[#D9ECF9]",
    card: "border-[#80BFEC] border-l-[#80BFEC] bg-white",
    pill: "bg-[#80BFEC] text-[#002368]",
  },
  {
    id: "IN_PROGRESS",
    title: "In progress",
    color: "border-[#FFC952] bg-[#FFF7E5]",
    card: "border-[#FFC952] border-l-[#FFC952] bg-white",
    pill: "bg-[#FFC952] text-[#14233B]",
  },
  {
    id: "BACKLOG",
    title: "Backlog",
    color: "border-[#818283] bg-[#ECECEC]",
    card: "border-[#818283] border-l-[#818283] bg-white",
    pill: "bg-[#ECECEC] text-[#14233B]",
  },
  {
    id: "COMPLETED",
    title: "Done",
    color: "border-[#002368] bg-[#002368]/[0.06]",
    card: "border-[#002368] border-l-[#002368] bg-white",
    pill: "on-navy",
  },
];

export function phaseStyle(status: string) {
  const id = columnForStatus(status);
  return BOARD_COLUMNS.find((column) => column.id === id) ?? BOARD_COLUMNS[2];
}

/** Older statuses still land in a visible stack. */
export function columnForStatus(status: string): TaskStatus {
  if (status === "IN_REVIEW" || status === "BLOCKED") return "IN_PROGRESS";
  if (status === "CANCELLED") return "BACKLOG";
  if (status === "TODO" || status === "IN_PROGRESS" || status === "BACKLOG" || status === "COMPLETED") {
    return status;
  }
  return "BACKLOG";
}

export const PRIORITY_LABELS: Record<string, { label: string; className: string }> = {
  "": { label: "No priority", className: "bg-[#ECECEC] text-[#4F555F]" },
  LOWEST: { label: "Lowest", className: "bg-[#ECECEC] text-[#4F555F]" },
  LOW: { label: "Low", className: "bg-[#D9ECF9] text-[#002368]" },
  MEDIUM: { label: "Medium", className: "bg-[#8091B3] text-white" },
  HIGH: { label: "High", className: "bg-[#FFC952] text-[#14233B]" },
  HIGHEST: { label: "Highest", className: "on-navy" },
};

export const TYPE_ICONS: Record<string, string> = {
  TASK: "✓",
  STORY: "📖",
  BUG: "🐛",
};
