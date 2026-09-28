import { z } from "zod";

export const PROGRESS_VALUES = ["not_started", "in_progress", "completed", "abandoned"] as const;
export const STATUS_VALUES = ["on_time", "late", "missed", "skipped"] as const;

const optionalText = z.string().trim().max(4000).optional().or(z.literal(""));
const progress = z.enum(PROGRESS_VALUES).optional().nullable();

export const submitOneToFiveSchema = z
  .object({
    workDate: z.string().date().optional(),
    slot1: optionalText,
    slot2: optionalText,
    slot3: optionalText,
    blockers: optionalText,
    notes: optionalText,
    priorSlot1Progress: progress,
    priorSlot2Progress: progress,
    priorSlot3Progress: progress,
    skipReason: optionalText,
  })
  .strict();

export const closeOneToFiveSchema = z
  .object({
    workDate: z.string().date().optional(),
    slot1Progress: progress,
    slot2Progress: progress,
    slot3Progress: progress,
  })
  .strict();

export const oneToFiveFeedbackSchema = z
  .object({
    oneToFiveId: z.string().uuid(),
    body: z.string().trim().min(1).max(2000),
  })
  .strict();

export const submitPulseSchema = z
  .object({
    departmentId: z.string().uuid(),
    weekThursday: z.string().date().optional(),
    wins: optionalText,
    risks: optionalText,
    helpNeeded: optionalText,
    skipReason: optionalText,
  })
  .strict();

export const holidaySchema = z
  .object({
    holidayDate: z.string().date(),
    name: z.string().trim().min(1).max(200),
  })
  .strict();

export const extraDaySchema = z
  .object({
    workDate: z.string().date(),
    reason: z.string().trim().max(400).optional().or(z.literal("")),
  })
  .strict();
