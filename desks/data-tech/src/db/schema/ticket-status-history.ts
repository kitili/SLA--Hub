import { pgTable, uuid, timestamp } from "drizzle-orm/pg-core";
import { tickets, ticketPhaseEnum } from "./tickets";
import { users } from "./users";

export const ticketStatusHistory = pgTable("ticket_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  fromPhase: ticketPhaseEnum("from_phase"),
  toPhase: ticketPhaseEnum("to_phase").notNull(),
  changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
});
