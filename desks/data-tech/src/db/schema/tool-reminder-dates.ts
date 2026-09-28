import { pgTable, uuid, text, date, boolean, timestamp } from "drizzle-orm/pg-core";
import { tools } from "./tools";

// Arbitrary labeled reminder dates on a tool — warranty expiry, annual service, insurance
// renewal, etc. — all sharing the same fixed 7/3/2/1/0-day reminder schedule as
// subscriptions, notifying Tech Tools managers + admins (no per-date recipient list).
export const toolReminderDates = pgTable("tool_reminder_dates", {
  id: uuid("id").primaryKey().defaultRandom(),
  toolId: uuid("tool_id")
    .notNull()
    .references(() => tools.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  date: date("date").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
