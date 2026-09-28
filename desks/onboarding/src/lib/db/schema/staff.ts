/**
 * `staff` table — every onboarding participant.
 *
 * Ported 1:1 (semantics) from `legacy/server/db/schema.sql`. Column types,
 * lengths, nullability, defaults and indexes match the legacy PostgreSQL DDL
 * exactly so existing data and behavior carry over unchanged.
 *
 * See docs/schema-conventions.md for naming rules.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const staff = pgTable(
  "staff",
  {
    /** Surrogate primary key. Defaults via `gen_random_uuid()` (pgcrypto). */
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** Normalized (lowercased) work email. Unique business key. */
    email: varchar("email", { length: 255 }).notNull().unique(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    campus: varchar("campus", { length: 100 }),
    jobTitle: varchar("job_title", { length: 150 }),
    /** ed-admin directory Staff ID — stable external key for sign-in. */
    edAdminStaffId: varchar("ed_admin_staff_id", { length: 64 }),
    isAdmin: boolean("is_admin").notNull().default(false),
    adminPasswordHash: varchar("admin_password_hash", { length: 255 }),
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
  },
  (table) => [index("idx_staff_email").on(table.email)],
);

export type Staff = typeof staff.$inferSelect;
export type NewStaff = typeof staff.$inferInsert;
