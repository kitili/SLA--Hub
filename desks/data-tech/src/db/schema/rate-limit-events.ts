import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";

// One row per attempt; checkRateLimit() counts rows for a key within a sliding window.
export const rateLimitEvents = pgTable(
  "rate_limit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("rate_limit_events_key_created_idx").on(table.key, table.createdAt)],
);
