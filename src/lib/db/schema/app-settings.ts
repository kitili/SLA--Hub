import { sql } from "drizzle-orm";
import { timestamp, pgTable, text, varchar } from "drizzle-orm/pg-core";

/**
 * General key-value settings store for admin-configurable values.
 * Add new keys as needed — each row is a single setting.
 */
export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 128 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type AppSetting = typeof appSettings.$inferSelect;
