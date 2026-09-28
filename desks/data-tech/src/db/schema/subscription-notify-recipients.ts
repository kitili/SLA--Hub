import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { subscriptions } from "./subscriptions";

// Who gets emailed about a specific subscription's renewal reminders. Empty for a given
// subscription falls back to Tech Tools managers + admins (see getTechToolsManagers()).
export const subscriptionNotifyRecipients = pgTable(
  "subscription_notify_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("subscription_notify_recipients_unique_idx").on(table.subscriptionId, table.email)],
);
