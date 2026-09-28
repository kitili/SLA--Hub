import "server-only";

/**
 * streak.ts — pure day-boundary rules for the consecutive-day feedback streak.
 *
 * The streak counts EAT calendar days (see `@/lib/time/eat`): a member's first
 * rating of a day either holds the streak (already counted today), extends it
 * by one (last counted day was yesterday), or restarts it at 1 (any gap).
 * `longestStreak` is a high-water mark and never decreases.
 *
 * This lives outside `@/lib/actions/feedback` because that module is
 * `"use server"` and may only export async server actions; keeping the
 * decision pure lets unit tests exercise every day boundary with plain date
 * keys — no database, no wall clock. `server-only` keeps it out of client
 * bundles alongside the rest of the points/streak logic.
 */

/**
 * Given an EAT date key (`YYYY-MM-DD`), return the previous calendar day in the
 * same format. Parsed as a UTC instant so the arithmetic is DST-free and never
 * shifts the date by a local-timezone offset.
 */
export function previousDateKey(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** The fields `advanceStreak` reads from an existing `feedback_streak` row. */
export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  /** EAT date key (`YYYY-MM-DD`) of the last counted feedback, if any. */
  lastFeedbackDate: string | null;
}

/**
 * Decide the streak after a first-time rating submitted on `todayKey`.
 *
 * @param prev     The member's existing streak row, if any.
 * @param todayKey The EAT calendar day of the submission (`eatNow().dateKey`).
 */
export function advanceStreak(
  prev: StreakState | undefined,
  todayKey: string,
): { currentStreak: number; longestStreak: number } {
  let currentStreak: number;
  if (prev?.lastFeedbackDate === todayKey) {
    // Already counted today — leave the streak as-is.
    currentStreak = prev.currentStreak;
  } else if (prev?.lastFeedbackDate === previousDateKey(todayKey)) {
    currentStreak = prev.currentStreak + 1;
  } else {
    currentStreak = 1;
  }
  return {
    currentStreak,
    longestStreak: Math.max(prev?.longestStreak ?? 0, currentStreak),
  };
}
