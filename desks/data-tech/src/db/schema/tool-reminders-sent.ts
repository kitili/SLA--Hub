import { pgTable, uuid, date, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { toolReminderDates } from "./tool-reminder-dates";

// One row per (reminder date, date value, offset) actually sent — mirrors
// subscription_reminders_sent. The unique index is what prevents a daily cron re-run from
// emailing the same reminder twice; including the date value means editing the date to a
// new value naturally allows fresh reminders for it.
export const toolRemindersSent = pgTable(
  "tool_reminders_sent",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reminderDateId: uuid("reminder_date_id")
      .notNull()
      .references(() => toolReminderDates.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    offsetDays: integer("offset_days").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("tool_reminders_sent_unique_idx").on(table.reminderDateId, table.date, table.offsetDays)],
);
