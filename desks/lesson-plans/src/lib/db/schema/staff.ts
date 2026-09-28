/**
 * `staff` table — every signed-in user (teachers and admins).
 *
 * Historical note: ported 1:1 (semantics) from the pre-Next Express app's
 * PostgreSQL DDL (no longer in this repo). Column types, lengths, nullability,
 * defaults and indexes were kept exact so existing data carried over unchanged.
 *
 * See docs/schema-conventions.md for naming rules.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const staff = pgTable("staff", {
  /** Surrogate primary key. Defaults via `gen_random_uuid()` (pgcrypto). */
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  /**
   * Normalized (lowercased) work email. Unique business key; the unique
   * constraint's index also serves email lookups.
   */
  email: varchar("email", { length: 255 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  campus: varchar("campus", { length: 100 }),
  jobTitle: varchar("job_title", { length: 150 }),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /**
   * Onboarding clock start. Nullable; set on the member's first activity
   * (first read/quiz). Added in Wave 3 (lifecycle).
   */
  startedAt: timestamp("started_at", { withTimezone: true }),
});

export type Staff = typeof staff.$inferSelect;
export type NewStaff = typeof staff.$inferInsert;
