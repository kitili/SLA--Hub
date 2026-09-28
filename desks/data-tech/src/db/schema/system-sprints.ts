import { pgTable, uuid, text, integer, date, timestamp, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { systems } from "./systems";
import { systemPhases } from "./system-phases";

export const sprintStatusEnum = pgEnum("sprint_status", ["planned", "active", "completed"]);

export const systemSprints = pgTable(
  "system_sprints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    systemId: uuid("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    phaseId: uuid("phase_id").references(() => systemPhases.id, { onDelete: "set null" }),
    number: integer("number").notNull(),
    name: text("name").notNull(),
    goal: text("goal"),
    status: sprintStatusEnum("status").notNull().default("planned"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    reviewNotes: text("review_notes"),
    retroWentWell: text("retro_went_well"),
    retroImprove: text("retro_improve"),
    retroActions: text("retro_actions"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("system_sprints_number_unique").on(table.systemId, table.number)],
);
