import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { tickets } from "./tickets";
import { users } from "./users";

// Comment thread on a ticket; the accepted fix is the row with isSolution = true.
export const ticketSolutions = pgTable("ticket_solutions", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  body: text("body").notNull(),
  isSolution: boolean("is_solution").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
