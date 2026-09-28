import "server-only";

/**
 * points.ts — read helpers for the gamification ledger.
 *
 * Points are stored append-only in `points_ledger` (one row per award); a
 * staff member's running total is the SUM of their `points`. The consecutive-
 * day feedback streak lives in `feedback_streak` (one row per staff member).
 *
 * These are pure read helpers — all writes go through `submitFeedback`
 * (`@/lib/actions/feedback`). `server-only` keeps this out of any client bundle
 * (it touches the database).
 */
import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { feedbackStreak, pointsLedger } from "@/lib/db/schema";

/**
 * Sum of all points awarded to a staff member. Returns `0` when the member has
 * no ledger rows yet (coalesced server-side).
 *
 * @param staffId The acting staff UUID (a `CurrentUser.id`).
 */
export async function getPointsTotal(staffId: string): Promise<number> {
  const rows = await db
    .select({
      total: sql<number>`coalesce(sum(${pointsLedger.points}), 0)`.mapWith(
        Number,
      ),
    })
    .from(pointsLedger)
    .where(eq(pointsLedger.staffId, staffId));

  return rows[0]?.total ?? 0;
}

/**
 * The staff member's current and longest consecutive-day feedback streaks.
 * Defaults to `{ currentStreak: 0, longestStreak: 0 }` when no streak row
 * exists yet.
 *
 * @param staffId The acting staff UUID (a `CurrentUser.id`).
 */
export async function getStreak(
  staffId: string,
): Promise<{ currentStreak: number; longestStreak: number }> {
  const rows = await db
    .select({
      currentStreak: feedbackStreak.currentStreak,
      longestStreak: feedbackStreak.longestStreak,
    })
    .from(feedbackStreak)
    .where(eq(feedbackStreak.staffId, staffId))
    .limit(1);

  const row = rows[0];
  return {
    currentStreak: row?.currentStreak ?? 0,
    longestStreak: row?.longestStreak ?? 0,
  };
}
