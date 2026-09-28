export type OneToFiveProgress = "not_started" | "in_progress" | "completed" | "abandoned";
export type OneToFiveStatus = "on_time" | "late" | "missed" | "skipped";

export const PROGRESS_LABELS: Record<OneToFiveProgress, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  abandoned: "Abandoned",
};

export const STATUS_LABELS: Record<OneToFiveStatus, string> = {
  on_time: "On time",
  late: "Late",
  missed: "Missed",
  skipped: "Skipped",
};
