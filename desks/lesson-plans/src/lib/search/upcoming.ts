import "server-only";

/**
 * upcoming.ts — "your next lessons" recommendation query.
 *
 * Given a teacher, suggest the published lesson plans they are most likely to
 * teach next:
 *
 *   1. Look up their most recent `plan_usage_events` row (by `occurred_at`).
 *   2. No history → fall back to the very first published plans in catalogue
 *      order (grade, subject, term, week, lesson).
 *   3. Have history → load that plan, then return published plans in the SAME
 *      (grade, subject) that come strictly AFTER it in (term, week, lesson)
 *      order. "Strictly after" is lexicographic over (termOrdinal, week, lesson).
 *
 * Server-only: queries the DB singleton directly.
 */
import { and, asc, desc, eq, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { lessonPlans, planUsageEvents } from "@/lib/db/schema";
import type { LessonPlan } from "@/lib/db/schema";

/** Default catalogue ordering: grade, subject, term, week, lesson (ascending). */
const CATALOGUE_ORDER = [
  asc(lessonPlans.gradeNum),
  asc(lessonPlans.subject),
  asc(lessonPlans.termOrdinal),
  asc(lessonPlans.week),
  asc(lessonPlans.lesson),
] as const;

/**
 * Published plans the teacher is most likely to open next.
 *
 * @param staffId  The acting staff UUID (CurrentUser.id).
 * @param limit    Max plans to return (default 3).
 * @returns        Up to `limit` published `LessonPlan` rows. Empty only when
 *                 the catalogue itself has no published plans after the cursor.
 */
export async function getUpcomingForTeacher(
  staffId: string,
  limit = 3,
): Promise<LessonPlan[]> {
  // 1. Most recent usage event for this teacher.
  const [lastEvent] = await db
    .select({ planId: planUsageEvents.planId })
    .from(planUsageEvents)
    .where(eq(planUsageEvents.staffId, staffId))
    .orderBy(desc(planUsageEvents.occurredAt))
    .limit(1);

  // 2. No history → first published plans in catalogue order.
  if (!lastEvent) {
    return db
      .select()
      .from(lessonPlans)
      .where(eq(lessonPlans.status, "published"))
      .orderBy(...CATALOGUE_ORDER)
      .limit(limit);
  }

  // 3a. Load the last-used plan to anchor the "strictly after" window.
  const [lastPlan] = await db
    .select()
    .from(lessonPlans)
    .where(eq(lessonPlans.id, lastEvent.planId))
    .limit(1);

  // The plan may have been deleted/unpublished since it was used. Degrade
  // gracefully to the catalogue head rather than returning nothing.
  if (!lastPlan) {
    return db
      .select()
      .from(lessonPlans)
      .where(eq(lessonPlans.status, "published"))
      .orderBy(...CATALOGUE_ORDER)
      .limit(limit);
  }

  const { termOrdinal: x, week: y, lesson: z } = lastPlan;

  // 3b. Same (grade, subject), strictly after (x, y, z) in (term, week, lesson).
  //     strictlyAfter ≡ term > x
  //                   OR (term = x AND week > y)
  //                   OR (term = x AND week = y AND lesson > z)
  const strictlyAfter = or(
    sql`${lessonPlans.termOrdinal} > ${x}`,
    and(eq(lessonPlans.termOrdinal, x), sql`${lessonPlans.week} > ${y}`),
    and(
      eq(lessonPlans.termOrdinal, x),
      eq(lessonPlans.week, y),
      sql`${lessonPlans.lesson} > ${z}`,
    ),
  );

  return db
    .select()
    .from(lessonPlans)
    .where(
      and(
        eq(lessonPlans.status, "published"),
        eq(lessonPlans.grade, lastPlan.grade),
        eq(lessonPlans.subject, lastPlan.subject),
        strictlyAfter,
      ),
    )
    .orderBy(
      asc(lessonPlans.termOrdinal),
      asc(lessonPlans.week),
      asc(lessonPlans.lesson),
    )
    .limit(limit);
}
