import { pgTable, uuid, text, date, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users";
import { departments } from "./departments";

export const systemStatusEnum = pgEnum("system_status", [
  "active",
  "in_development",
  "maintenance",
  "deprecated",
]);

// Distinct from systemStatusEnum: status is the system's maturity, state is whether its
// task board is open to everyone with view access or locked down to the lead/managers.
export const projectStateEnum = pgEnum("project_state", ["open", "closed"]);

// The catalog of in-house systems Silverleaf builds and runs — not third-party tools.
export const systems = pgTable("systems", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  // One feature per array element, shown as a bullet list.
  features: text("features").array().notNull().default([]),
  techStack: text("tech_stack").array().notNull().default([]),
  url: text("url"),
  status: systemStatusEnum("status").notNull().default("active"),
  leadId: uuid("lead_id").references(() => users.id, { onDelete: "set null" }),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
  state: projectStateEnum("state").notNull().default("open"),
  startDate: date("start_date"),
  targetDate: date("target_date"),
  wipInProgress: integer("wip_in_progress").default(3),
  wipReview: integer("wip_review").default(3),
  defaultCapacityPoints: integer("default_capacity_points").default(8),
  defaultCapacityMinutes: integer("default_capacity_minutes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
