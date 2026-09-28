export const TOOL_STATUS_TONE = {
  available: "success",
  allocated: "danger",
  in_repair: "warning",
  retired: "neutral",
} as const;

export const TOOL_CONDITION_TONE = {
  new: "success",
  good: "success",
  fair: "warning",
  damaged: "danger",
  faulty: "danger",
  retired: "neutral",
} as const;
