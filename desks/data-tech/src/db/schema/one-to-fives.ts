import { pgTable, uuid, text, timestamp, date, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";
import { departments } from "./departments";

export const oneToFiveStatusEnum = pgEnum("one_to_five_status", ["on_time", "late", "missed", "skipped"]);
export const oneToFiveProgressEnum = pgEnum("one_to_five_progress", [
  "not_started",
  "in_progress",
  "completed",
  "abandoned",
]);

export const oneToFives = pgTable(
  "one_to_fives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workDate: date("work_date").notNull(),
    slot1: text("slot_1"),
    slot2: text("slot_2"),
    slot3: text("slot_3"),
    blockers: text("blockers"),
    notes: text("notes"),
    priorSlot1Progress: oneToFiveProgressEnum("prior_slot_1_progress"),
    priorSlot2Progress: oneToFiveProgressEnum("prior_slot_2_progress"),
    priorSlot3Progress: oneToFiveProgressEnum("prior_slot_3_progress"),
    slot1Progress: oneToFiveProgressEnum("slot_1_progress"),
    slot2Progress: oneToFiveProgressEnum("slot_2_progress"),
    slot3Progress: oneToFiveProgressEnum("slot_3_progress"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    status: oneToFiveStatusEnum("status").notNull().default("on_time"),
    skipReason: text("skip_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("one_to_fives_user_date_idx").on(table.userId, table.workDate)],
);

export const oneToFiveHolidays = pgTable(
  "one_to_five_holidays",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    holidayDate: date("holiday_date").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("one_to_five_holidays_date_idx").on(table.holidayDate)],
);

export const oneToFiveExtraDays = pgTable(
  "one_to_five_extra_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workDate: date("work_date").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("one_to_five_extra_days_date_idx").on(table.workDate)],
);

export const pulseChecks = pgTable(
  "pulse_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    weekThursday: date("week_thursday").notNull(),
    wins: text("wins"),
    risks: text("risks"),
    helpNeeded: text("help_needed"),
    submittedBy: uuid("submitted_by").references(() => users.id, { onDelete: "set null" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    status: oneToFiveStatusEnum("status").notNull().default("on_time"),
    skipReason: text("skip_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("pulse_checks_dept_week_idx").on(table.departmentId, table.weekThursday)],
);

export const oneToFiveFeedback = pgTable("one_to_five_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  oneToFiveId: uuid("one_to_five_id")
    .notNull()
    .references(() => oneToFives.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
