import { z } from "zod";

const SYSTEM_STATUSES = ["active", "in_development", "maintenance", "deprecated"] as const;
const PROJECT_STATES = ["open", "closed"] as const;
const TASK_STATUSES = ["backlog", "todo", "in_progress", "review", "done"] as const;
const TASK_PRIORITIES = ["urgent", "high", "medium", "low"] as const;
const TASK_RECURRENCES = ["none", "daily", "weekly", "monthly"] as const;

export const createSystemSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    features: z.array(z.string().min(1).max(300)).max(100).optional(),
    techStack: z.array(z.string().min(1).max(100)).max(100).optional(),
    url: z.string().url().optional(),
    status: z.enum(SYSTEM_STATUSES).optional(),
    leadId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
    state: z.enum(PROJECT_STATES).optional(),
    startDate: z.string().date().optional(),
    targetDate: z.string().date().optional(),
    wipInProgress: z.number().int().min(1).max(50).nullable().optional(),
    wipReview: z.number().int().min(1).max(50).nullable().optional(),
    defaultCapacityPoints: z.number().int().min(0).max(200).nullable().optional(),
    defaultCapacityMinutes: z.number().int().min(0).max(20000).nullable().optional(),
  })
  .strict();

export const updateSystemSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(4000).nullable().optional(),
    features: z.array(z.string().min(1).max(300)).max(100).optional(),
    techStack: z.array(z.string().min(1).max(100)).max(100).optional(),
    url: z.string().url().nullable().optional(),
    status: z.enum(SYSTEM_STATUSES).optional(),
    leadId: z.string().uuid().nullable().optional(),
    departmentId: z.string().uuid().nullable().optional(),
    state: z.enum(PROJECT_STATES).optional(),
    startDate: z.string().date().nullable().optional(),
    targetDate: z.string().date().nullable().optional(),
    wipInProgress: z.number().int().min(1).max(50).nullable().optional(),
    wipReview: z.number().int().min(1).max(50).nullable().optional(),
    defaultCapacityPoints: z.number().int().min(0).max(200).nullable().optional(),
    defaultCapacityMinutes: z.number().int().min(0).max(20000).nullable().optional(),
  })
  .strict();

export const createTaskSchema = z
  .object({
    title: z.string().min(1).max(300),
    description: z.string().max(8000).optional(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    assigneeId: z.string().uuid().optional(),
    assigneeIds: z.array(z.string().uuid()).max(50).optional(),
    parentTaskId: z.string().uuid().optional(),
    completionPercentage: z.number().int().min(0).max(100).optional(),
    startDate: z.string().date().optional(),
    dueDate: z.string().date().optional(),
    timeEstimateMinutes: z.number().int().min(0).max(100000).optional(),
    points: z.number().int().min(0).max(1000).optional(),
    recurrence: z.enum(TASK_RECURRENCES).optional(),
    phaseId: z.string().uuid().nullable().optional(),
    sprintId: z.string().uuid().nullable().optional(),
  })
  .strict();

export const updateTaskSchema = z
  .object({
    title: z.string().min(1).max(300).optional(),
    description: z.string().max(8000).nullable().optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    status: z.enum(TASK_STATUSES).optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    assigneeIds: z.array(z.string().uuid()).max(50).optional(),
    completionPercentage: z.number().int().min(0).max(100).optional(),
    startDate: z.string().date().nullable().optional(),
    dueDate: z.string().date().nullable().optional(),
    timeEstimateMinutes: z.number().int().min(0).max(100000).nullable().optional(),
    points: z.number().int().min(0).max(1000).nullable().optional(),
    recurrence: z.enum(TASK_RECURRENCES).optional(),
    archived: z.boolean().optional(),
    phaseId: z.string().uuid().nullable().optional(),
    sprintId: z.string().uuid().nullable().optional(),
  })
  .strict();

export const createPhaseSchema = z
  .object({
    name: z.string().min(1).max(120),
    goal: z.string().max(2000).optional(),
    startDate: z.string().date().optional(),
    targetDate: z.string().date().optional(),
  })
  .strict();

export const updatePhaseSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    goal: z.string().max(2000).nullable().optional(),
    startDate: z.string().date().nullable().optional(),
    targetDate: z.string().date().nullable().optional(),
  })
  .strict();

export const createSprintSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    goal: z.string().max(2000).optional(),
    phaseId: z.string().uuid().optional(),
    startDate: z.string().date().optional(),
    endDate: z.string().date().optional(),
  })
  .strict();

export const updateSprintSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    goal: z.string().max(2000).nullable().optional(),
    phaseId: z.string().uuid().nullable().optional(),
    startDate: z.string().date().nullable().optional(),
    endDate: z.string().date().nullable().optional(),
    reviewNotes: z.string().max(8000).nullable().optional(),
    retroWentWell: z.string().max(8000).nullable().optional(),
    retroImprove: z.string().max(8000).nullable().optional(),
    retroActions: z.string().max(8000).nullable().optional(),
    action: z.enum(["start", "complete", "return_unfinished"]).optional(),
  })
  .strict();

export const upsertCapacitiesSchema = z
  .object({
    rows: z
      .array(
        z.object({
          userId: z.string().uuid(),
          points: z.number().int().min(0).max(200),
          minutes: z.number().int().min(0).max(20000),
        }),
      )
      .max(80),
  })
  .strict();

export const taskExtrasSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add_comment"), body: z.string().min(1).max(8000) }),
  z.object({ op: z.literal("delete_comment"), commentId: z.string().uuid() }),
  z.object({ op: z.literal("add_checklist"), title: z.string().min(1).max(200) }),
  z.object({ op: z.literal("rename_checklist"), checklistId: z.string().uuid(), title: z.string().min(1).max(200) }),
  z.object({ op: z.literal("delete_checklist"), checklistId: z.string().uuid() }),
  z.object({ op: z.literal("add_checklist_item"), checklistId: z.string().uuid(), title: z.string().min(1).max(300) }),
  z.object({ op: z.literal("toggle_checklist_item"), itemId: z.string().uuid(), done: z.boolean() }),
  z.object({ op: z.literal("delete_checklist_item"), itemId: z.string().uuid() }),
  z.object({ op: z.literal("set_assignees"), userIds: z.array(z.string().uuid()).max(50) }),
  z.object({ op: z.literal("set_watchers"), userIds: z.array(z.string().uuid()).max(50) }),
  z.object({
    op: z.literal("add_tag"),
    name: z.string().min(1).max(40),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  }),
  z.object({ op: z.literal("remove_tag"), tagId: z.string().uuid() }),
  z.object({ op: z.literal("add_dependency"), dependsOnTaskId: z.string().uuid() }),
  z.object({ op: z.literal("remove_dependency"), dependsOnTaskId: z.string().uuid() }),
  z.object({
    op: z.literal("log_time"),
    minutes: z.number().int().min(1).max(24 * 60),
    note: z.string().max(300).optional(),
    spentOn: z.string().date().optional(),
  }),
  z.object({ op: z.literal("delete_time"), entryId: z.string().uuid() }),
  z.object({ op: z.literal("delete_attachment"), attachmentId: z.string().uuid() }),
]);

export const moveTaskSchema = z
  .object({
    status: z.enum(TASK_STATUSES),
    index: z.number().int().min(0),
  })
  .strict();
