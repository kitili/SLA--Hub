export const SYSTEM_STATUS_TONE = {
  active: "success",
  in_development: "info",
  maintenance: "warning",
  deprecated: "neutral",
} as const;

export const TASK_PRIORITY_TONE = {
  low: "neutral",
  medium: "info",
  high: "warning",
  urgent: "danger",
} as const;
