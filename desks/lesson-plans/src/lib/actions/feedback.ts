"use server";

/**
 * Feedback server action — submit (or re-rate) a lesson plan, award points, and
 * maintain the consecutive-day feedback streak.
 *
 * Identity is always re-resolved server-side (never trust a client id). The
 * mutation runs in a single transaction for atomicity:
 *
 *   - First-time feedback for (staff, plan) → insert the rating, award +10
 *     ("feedback_given"), plus +5 during Feedback Hour ("feedback_hour_bonus"),
 *     and advance the streak.
 *   - Re-rating an already-rated plan → update the rating/comment only. NO new
 *     points and NO streak change (re-rating is free and idempotent).
 *
 * After commit we revalidate the home route (which renders the Feedback Hour /
 * points UI) and the plan page so the new rating shows immediately.
 */
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { getCurrentUser } from "@/lib/auth";
import type { ActionResult } from "@/lib/contracts";
import { db } from "@/lib/db";
import { feedbackStreak, planFeedback, pointsLedger } from "@/lib/db/schema";
import { advanceStreak } from "@/lib/streak";
import { eatNow, isFeedbackHour } from "@/lib/time/eat";

/** Points awarded the first time a staff member rates a plan. */
const POINTS_FEEDBACK_GIVEN = 10;
/** Extra points when that first rating lands during Feedback Hour. */
const POINTS_FEEDBACK_HOUR_BONUS = 5;

/**
 * Error codes:
 * - "unauthenticated" → no active session.
 * - "invalid"         → rating outside 1..5.
 * - "failed"          → unexpected error (e.g. unknown plan / db error).
 */
export interface SubmitFeedbackResult
  extends ActionResult<"unauthenticated" | "invalid" | "failed"> {
  /** Points newly awarded by THIS submission (0 when re-rating). */
  awardedPoints?: number;
  /** The staff member's streak after this submission. */
  currentStreak?: number;
}

/**
 * Submit feedback for a lesson plan on behalf of the current user.
 *
 * @param input.planId  The lesson plan UUID being rated.
 * @param input.rating  Star rating, 1–5 inclusive.
 * @param input.comment Optional free-text comment.
 */
export async function submitFeedback(input: {
  planId: string;
  rating: number;
  comment?: string;
}): Promise<SubmitFeedbackResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "invalid" };
  }

  const planId = input.planId;
  const comment = input.comment?.trim() ? input.comment.trim() : null;
  const now = new Date();

  try {
    const result = await db.transaction(async (tx) => {
      // Existing feedback for this (staff, plan)? Re-rating is free.
      const existing = await tx
        .select({ id: planFeedback.id })
        .from(planFeedback)
        .where(
          and(
            eq(planFeedback.staffId, user.id),
            eq(planFeedback.planId, planId),
          ),
        )
        .limit(1);

      if (existing[0]) {
        // Re-rate: update only. No points, no streak change.
        await tx
          .update(planFeedback)
          .set({ rating, comment, updatedAt: now })
          .where(eq(planFeedback.id, existing[0].id));

        const streakRows = await tx
          .select({ currentStreak: feedbackStreak.currentStreak })
          .from(feedbackStreak)
          .where(eq(feedbackStreak.staffId, user.id))
          .limit(1);

        return {
          awardedPoints: 0,
          currentStreak: streakRows[0]?.currentStreak ?? 0,
        };
      }

      // First-time feedback for this plan.
      await tx.insert(planFeedback).values({
        staffId: user.id,
        planId,
        rating,
        comment,
        createdAt: now,
        updatedAt: now,
      });

      // Award base points (+ Feedback Hour bonus if applicable).
      const inFeedbackHour = isFeedbackHour(now);
      const awardedPoints =
        POINTS_FEEDBACK_GIVEN +
        (inFeedbackHour ? POINTS_FEEDBACK_HOUR_BONUS : 0);

      await tx.insert(pointsLedger).values({
        staffId: user.id,
        points: POINTS_FEEDBACK_GIVEN,
        reason: "feedback_given",
        planId,
        awardedAt: now,
      });

      if (inFeedbackHour) {
        await tx.insert(pointsLedger).values({
          staffId: user.id,
          points: POINTS_FEEDBACK_HOUR_BONUS,
          reason: "feedback_hour_bonus",
          planId,
          awardedAt: now,
        });
      }

      // Advance the consecutive-day streak — the EAT day-boundary rules
      // (hold / extend / reset, longest high-water mark) live in @/lib/streak.
      const today = eatNow(now).dateKey;

      const streakRows = await tx
        .select()
        .from(feedbackStreak)
        .where(eq(feedbackStreak.staffId, user.id))
        .limit(1);
      const { currentStreak, longestStreak } = advanceStreak(
        streakRows[0],
        today,
      );

      await tx
        .insert(feedbackStreak)
        .values({
          staffId: user.id,
          currentStreak,
          longestStreak,
          lastFeedbackDate: today,
        })
        .onConflictDoUpdate({
          target: feedbackStreak.staffId,
          set: { currentStreak, longestStreak, lastFeedbackDate: today },
        });

      return { awardedPoints, currentStreak };
    });

    // Refresh the home (Feedback Hour / points) view and the plan page.
    // Both routes live under the `[locale]` segment, so target the route
    // patterns: revalidatePath matches the filesystem route as Next.js sees
    // it (`/en/plans/x`, `/sw/plans/x`) — a locale-less literal like
    // `/plans/x` never matches anything, and middleware rewriting applies
    // only to incoming requests, not revalidation keys. The pages are
    // force-dynamic today, so this mainly drives the client-side router
    // refresh after the action — and stays correct if caching is added.
    revalidatePath("/[locale]", "page");
    revalidatePath("/[locale]/plans/[slug]", "page");

    return {
      ok: true,
      awardedPoints: result.awardedPoints,
      currentStreak: result.currentStreak,
    };
  } catch {
    return { ok: false, error: "failed" };
  }
}
