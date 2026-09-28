import { z } from "zod";

export const createSubscriptionSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    url: z.string().url().optional(),
    renewalDate: z.string().date(),
    departmentIds: z.array(z.string().uuid()).max(50).optional(),
    notifyEmails: z.array(z.string().email()).max(50).optional(),
  })
  .strict();

export const updateSubscriptionSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    url: z.string().url().nullable().optional(),
    renewalDate: z.string().date().optional(),
    isActive: z.boolean().optional(),
    departmentIds: z.array(z.string().uuid()).max(50).optional(),
    notifyEmails: z.array(z.string().email()).max(50).optional(),
  })
  .strict();
