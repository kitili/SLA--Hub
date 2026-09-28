import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

// Who gets emailed when a new ticket is submitted — managed explicitly here rather than
// inferred from admin/hod accounts, so it can include a shared inbox or exclude someone.
export const ticketNotifyRecipients = pgTable("ticket_notify_recipients", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
