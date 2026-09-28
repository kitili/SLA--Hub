/**
 * Teacher points schema — gamification: a points ledger and a feedback streak.
 *
 * New in the lesson-plans wave.
 *
 *   - `points_ledger`   append-only award log (one row per award). The running
 *                       total is the sum of `points` for a staff member.
 *   - `feedback_streak` per-staff streak counters for consecutive-day feedback.
 *
 * See docs/schema-conventions.md for naming rules.
 */
import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { staff } from "./staff";

/** Append-only points award log. */
export const pointsLedger = pgTable(
  "points_ledger",
  {
    /** Surrogate primary key. Defaults via `gen_random_uuid()` (pgcrypto). */
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id),
    points: integer("points").notNull(),
    reason: text("reason").notNull(),
    /**
     * Provenance only — deliberately NOT a foreign key: the ledger is
     * append-only and an award must survive deletion of the plan that earned
     * it, so points totals never silently drop.
     */
    planId: uuid("plan_id"),
    awardedAt: timestamp("awarded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("points_ledger_staff_awarded_idx").on(
      table.staffId,
      table.awardedAt,
    ),
  ],
);

/** Per-staff consecutive-day feedback streak counters. */
export const feedbackStreak = pgTable("feedback_streak", {
  staffId: uuid("staff_id")
    .primaryKey()
    .references(() => staff.id),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastFeedbackDate: date("last_feedback_date"),
});

export type PointsLedger = typeof pointsLedger.$inferSelect;
export type NewPointsLedger = typeof pointsLedger.$inferInsert;
export type FeedbackStreak = typeof feedbackStreak.$inferSelect;
export type NewFeedbackStreak = typeof feedbackStreak.$inferInsert;
