/**
 * Search misses schema — logs searches that returned no useful result.
 *
 * New in the lesson-plans wave. Drives a "content gap" report so missing
 * lesson plans can be authored or generated.
 *
 * See docs/schema-conventions.md for naming rules.
 */
import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { staff } from "./staff";

export const searchMisses = pgTable(
  "search_misses",
  {
    /** Surrogate primary key. Defaults via `gen_random_uuid()` (pgcrypto). */
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id),
    query: text("query").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("search_misses_occurred_at_idx").on(table.occurredAt)],
);

export type SearchMiss = typeof searchMisses.$inferSelect;
export type NewSearchMiss = typeof searchMisses.$inferInsert;
