import { z } from "zod";

import { applicationDetailSchema } from "./application-fields";
import { UUID_RE } from "./ids";

const optionalText = (max: number) => z.string().trim().max(max).optional();

export const createCandidateSchema = z
  .object({
    fullName: z.string().trim().min(1).max(255),
    email: z
      .string()
      .trim()
      .min(3)
      .max(254)
      .refine((value) => value.includes("@")),
    preferredEmail: optionalText(254),
    linkedin: optionalText(2000),
    cvLink: optionalText(2000),
    notes: optionalText(8000),
    roleApplied: optionalText(255),
    roleOther: optionalText(255),
    website: optionalText(200),
    companyUrl: optionalText(200),
    formStartedAt: z.coerce.number().optional(),
  })
  .merge(applicationDetailSchema)
  .strict();

export const patchCandidateSchema = z
  .object({
    notes: z.string().max(8000).optional(),
    linkedin: z.string().max(2000).optional(),
    cvLink: z.string().max(2000).optional(),
    performanceTaskLink: z.string().max(2000).optional(),
    cultureVideoFeedback: z.string().max(8000).optional(),
    clearCultureMarker: z.boolean().optional(),
    clearPerformanceMarker: z.boolean().optional(),
  })
  .strict();

export const completeApplicationSchema = z
  .object({
    action: z.literal("complete_application"),
    linkedin: optionalText(2000),
    cvLink: optionalText(2000),
  })
  .strict();

export const advanceCandidateSchema = z
  .object({
    action: z.enum([
      "culture",
      "performance",
      "online_interview",
      "in_person",
    ]),
    interviewDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    interviewStart: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    interviewEnd: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    interviewLocation: z.string().trim().max(500).optional(),
    interviewers: z.string().max(2000).optional(),
    taskId: z
      .string()
      .regex(UUID_RE, "Invalid task id")
      .optional(),
    reviewDepts: z.string().max(2000).optional(),
  })
  .strict();

export const outcomeSchema = z
  .object({
    outcome: z.enum(["hired", "rejected"]),
  })
  .strict();

export const createPerformanceTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().max(8000).nullable().optional(),
    fileLink: z.string().trim().max(2000).nullable().optional(),
    managerEmail: z.string().trim().max(254).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const updatePerformanceTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(8000).nullable().optional(),
    fileLink: z.string().trim().max(2000).nullable().optional(),
    managerEmail: z.string().trim().max(254).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const welcomeEmailSchema = z
  .object({
    startInfo: z.string().trim().max(4000).optional(),
  })
  .strict();

export const onboardingSubmitSchema = z
  .object({
    workEmail: z
      .string()
      .trim()
      .min(3)
      .max(254)
      .refine((value) => value.includes("@")),
    tempPassword: z.string().min(8).max(128),
  })
  .strict();
