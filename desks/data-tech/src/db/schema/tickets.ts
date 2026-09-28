import { pgTable, uuid, text, timestamp, pgEnum, customType } from "drizzle-orm/pg-core";
import { departments } from "./departments";
import { tools } from "./tools";
import { systemTasks } from "./system-tasks";

export const ticketPriorityEnum = pgEnum("ticket_priority", ["low", "medium", "high", "urgent"]);
export const ticketPhaseEnum = pgEnum("ticket_phase", ["unassigned", "in_progress", "complete"]);
export const ticketCategoryEnum = pgEnum("ticket_category", [
  "hardware",
  "software",
  "network",
  "access",
  "facilities",
  "other",
]);
export const ticketSourceEnum = pgEnum("ticket_source", ["public", "internal"]);
export const ticketImpactEnum = pgEnum("ticket_impact", ["individual", "classroom", "campus"]);

// Populated by a database trigger (see drizzle/ custom migration), not maintained in application code.
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const tickets = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketNumber: text("ticket_number").notNull().unique(),
  issue: text("issue").notNull(),
  // At least one of email/phone is enforced at the application layer (createTicketSchema) —
  // some submitters have no email address.
  submitterName: text("submitter_name"),
  submitterEmail: text("submitter_email"),
  submitterPhone: text("submitter_phone"),
  placeOfWork: text("place_of_work"),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
  // Set when a ticket was filed as a "report a problem" against a specific device.
  toolId: uuid("tool_id").references(() => tools.id, { onDelete: "set null" }),
  category: ticketCategoryEnum("category").notNull().default("other"),
  source: ticketSourceEnum("source").notNull().default("public"),
  impact: ticketImpactEnum("impact").notNull().default("individual"),
  campus: text("campus"),
  internalNotes: text("internal_notes"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  linkedTaskId: uuid("linked_task_id").references(() => systemTasks.id, { onDelete: "set null" }),
  priority: ticketPriorityEnum("priority").notNull().default("medium"),
  phase: ticketPhaseEnum("phase").notNull().default("unassigned"),
  searchVector: tsvector("search_vector"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});
