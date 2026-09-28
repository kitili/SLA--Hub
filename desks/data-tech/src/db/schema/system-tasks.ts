import { pgTable, uuid, text, integer, date, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { systems } from "./systems";
import { users } from "./users";
import { systemPhases } from "./system-phases";
import { systemSprints } from "./system-sprints";

export const taskStatusEnum = pgEnum("task_status", ["backlog", "todo", "in_progress", "review", "done"]);
export const taskPriorityEnum = pgEnum("task_priority", ["urgent", "high", "medium", "low"]);
export const taskRecurrenceEnum = pgEnum("task_recurrence", ["none", "daily", "weekly", "monthly"]);

// Kanban board tasks, one board per system. `position` orders cards within a column —
// moving a card re-sequences the affected column(s) rather than using gapped/fractional keys.
export const systemTasks = pgTable("system_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  systemId: uuid("system_id")
    .notNull()
    .references(() => systems.id, { onDelete: "cascade" }),
  parentTaskId: uuid("parent_task_id"),
  phaseId: uuid("phase_id").references(() => systemPhases.id, { onDelete: "set null" }),
  sprintId: uuid("sprint_id").references(() => systemSprints.id, { onDelete: "set null" }),
  taskNumber: integer("task_number").notNull().default(0),
  title: text("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").notNull().default("backlog"),
  priority: taskPriorityEnum("priority").notNull().default("medium"),
  assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
  completionPercentage: integer("completion_percentage").notNull().default(0),
  startDate: date("start_date"),
  dueDate: date("due_date"),
  timeEstimateMinutes: integer("time_estimate_minutes"),
  points: integer("points"),
  recurrence: taskRecurrenceEnum("recurrence").notNull().default("none"),
  archived: boolean("archived").notNull().default(false),
  position: integer("position").notNull().default(0),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  clickupTaskId: text("clickup_task_id"),
  clickupAssigneeId: text("clickup_assignee_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
