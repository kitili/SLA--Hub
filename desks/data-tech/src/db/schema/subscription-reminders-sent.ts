import { pgTable, uuid, date, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { subscriptions } from "./subscriptions";

// One row per (subscription, renewal date, offset) reminder actually sent — the unique
// index is what prevents a daily cron re-run from emailing the same reminder twice.
export const subscriptionRemindersSent = pgTable(
  "subscription_reminders_sent",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    renewalDate: date("renewal_date").notNull(),
    offsetDays: integer("offset_days").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("subscription_reminders_sent_unique_idx").on(table.subscriptionId, table.renewalDate, table.offsetDays)],
);
