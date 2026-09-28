import { z } from "zod";

export const createToolReminderSchema = z
  .object({
    label: z.string().min(1).max(200),
    date: z.string().date(),
  })
  .strict();

export const updateToolReminderSchema = z
  .object({
    label: z.string().min(1).max(200).optional(),
    date: z.string().date().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
