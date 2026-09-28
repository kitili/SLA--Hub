import "server-only";

/**
 * feedback-queries.ts — read helpers backing the Feedback + Feedback Hour UI.
 *
 * `server-only`: these touch the database and must never ship to a client
 * bundle. All writes go through `submitFeedback` (`@/lib/actions/feedback`).
 */
import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  lessonPlans,
  planFeedback,
  planUsageEvents,
  type LessonPlan,
} from "@/lib/db/schema";

/**
 * The current feedback a staff member has left for a plan, or `null` if none.
 * Used to prefill the rating control with their existing rating/comment.
 *
 * @param staffId The acting staff UUID (a `CurrentUser.id`).
 * @param planId  The lesson plan UUID.
 */
export async function getFeedbackByStaffPlan(
  staffId: string,
  planId: string,
): Promise<{ rating: number; comment: string | null } | null> {
  const rows = await db
    .select({ rating: planFeedback.rating, comment: planFeedback.comment })
    .from(planFeedback)
    .where(
      and(eq(planFeedback.staffId, staffId), eq(planFeedback.planId, planId)),
    )
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Published plans this staff member has recently used (viewed/opened/
 * downloaded) but has NOT yet rated, most-recently-used first.
 *
 * Strategy:
 *   1. Collapse the usage log to one row per plan, keyed by the most recent
 *      `occurred_at` for that (staff, plan) pair.
 *   2. Drop any plan that already has a `plan_feedback` row for this staff
 *      member (a `NOT EXISTS` correlated subquery — works on PGlite + Postgres).
 *   3. Order by recency and take `limit` plan ids.
 *   4. Load those published `lesson_plans` and re-order them to match the
 *      recency ordering (a single `IN (...)` fetch loses ORDER BY).
 *
 * @param staffId The acting staff UUID (a `CurrentUser.id`).
 * @param limit   Max plans to return (default 8).
 */
export async function getRecentlyUsedWithoutFeedback(
  staffId: string,
  limit = 8,
): Promise<LessonPlan[]> {
  // Step 1–3: distinct plan ids by most-recent usage, excluding already-rated.
  const recent = await db
    .select({
      planId: planUsageEvents.planId,
      lastUsed: sql<string>`max(${planUsageEvents.occurredAt})`,
    })
    .from(planUsageEvents)
    .where(
      and(
        eq(planUsageEvents.staffId, staffId),
        sql`not exists (
          select 1 from ${planFeedback}
          where ${planFeedback.planId} = ${planUsageEvents.planId}
            and ${planFeedback.staffId} = ${staffId}
        )`,
      ),
    )
    .groupBy(planUsageEvents.planId)
    .orderBy(sql`max(${planUsageEvents.occurredAt}) desc`)
    .limit(limit);

  const orderedIds = recent.map((r) => r.planId);
  if (orderedIds.length === 0) return [];

  // Step 4: load the published plans, then restore recency order.
  const plans = await db
    .select()
    .from(lessonPlans)
    .where(
      and(
        inArray(lessonPlans.id, orderedIds),
        eq(lessonPlans.status, "published"),
      ),
    );

  const byId = new Map(plans.map((p) => [p.id, p]));
  return orderedIds
    .map((id) => byId.get(id))
    .filter((p): p is LessonPlan => p !== undefined);
}
