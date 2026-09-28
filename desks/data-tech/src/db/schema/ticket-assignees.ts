import { pgTable, uuid, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { tickets } from "./tickets";
import { users } from "./users";

// Many-to-many: a ticket can have several assignees, addable at any phase.
export const ticketAssignees = pgTable(
  "ticket_assignees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    assignedBy: uuid("assigned_by").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [uniqueIndex("ticket_assignees_ticket_user_idx").on(table.ticketId, table.userId)],
);
