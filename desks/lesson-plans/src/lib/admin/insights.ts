import "server-only";

/**
 * Admin usage-insights query helpers.
 *
 * Read-only aggregate queries that power the admin dashboard and the feedback
 * review page. Every helper returns a small, fully-typed result shape so the
 * UI never touches Drizzle directly.
 *
 * Portability: these run on BOTH the embedded PGlite driver (local dev / tests)
 * and real PostgreSQL (preview / prod), so we lean on plain `sql` templates for
 * the few aggregates (avg, distinct count, interval filters) where a raw
 * expression is clearer and provably identical across drivers. Numeric
 * aggregates come back as strings from the PG wire protocol — we coerce with
 * `Number(...)` and round at the edge.
 */
import { and, desc, eq, gt, isNotNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  lessonPlans,
  planFeedback,
  planUsageEvents,
  pointsLedger,
  searchMisses,
  staff,
} from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface OverviewStats {
  totalPlans: number;
  publishedPlans: number;
  /** Distinct staff with a usage event in the last 14 days. */
  activeTeachers: number;
  /** Mean of every feedback rating, rounded to 1dp. `null` when no feedback. */
  avgRating: number | null;
}

export interface PlanViewCount {
  planId: string;
  slug: string;
  title: string;
  subject: string;
  grade: string;
  views: number;
}

export interface NoResultSearch {
  id: string;
  query: string;
  occurredAt: Date;
  /** Email of the searcher, or `null` if the staff row is gone. */
  searcherEmail: string | null;
}

export interface RecentComment {
  id: string;
  planId: string;
  slug: string;
  title: string;
  rating: number;
  comment: string;
  createdAt: Date;
  /** Email of the author, or `null` if the staff row is gone. */
  authorEmail: string | null;
}

export interface LowestRatedPlan {
  planId: string;
  slug: string;
  title: string;
  /** Mean rating for the plan, rounded to 1dp. */
  avgRating: number;
  feedbackCount: number;
}

export interface FeedbackHourParticipation {
  /** Total `feedback_hour_bonus` ledger rows. */
  awardCount: number;
  /** Distinct staff who earned at least one feedback-hour bonus. */
  distinctStaff: number;
}

export interface TeacherActivity {
  staffId: string;
  fullName: string;
  email: string;
  campus: string | null;
  /** Lesson-plan usage events (view + open + download). */
  planViews: number;
  /** Feedback rows the teacher has submitted. */
  feedbackGiven: number;
  /** No-result searches the teacher has run. */
  searches: number;
  /** planViews + feedbackGiven + searches. */
  totalActions: number;
  /**
   * Most recent moment of *any* signal — usage, feedback, search, or the
   * auth-touched `staff.lastActiveAt` (so a login-only teacher still counts).
   * `null` only if the row has somehow never been touched.
   */
  lastActiveAt: Date | null;
  /** Did anything happen inside the trailing {@link ACTIVE_WINDOW_DAYS} window? */
  isActive: boolean;
}

export interface ActivityTrendDay {
  /** Calendar day in UTC, `YYYY-MM-DD`. */
  day: string;
  /** Total actions (usage + feedback + search) that day. */
  events: number;
  /** Distinct teachers with at least one action that day. */
  activeTeachers: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Window (days) for the "active teachers" metric. */
const ACTIVE_WINDOW_DAYS = 14;

/** Minimum feedbacks before a plan can appear in the lowest-rated list. */
const MIN_FEEDBACKS_FOR_RANKING = 1;

/** Ledger reason tag awarded for feedback given during the Feedback Hour. */
const FEEDBACK_HOUR_REASON = "feedback_hour_bonus";

/** Default span (days) for the teacher-activity trend chart. */
const ACTIVITY_TREND_DAYS = 14;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Round to one decimal place, guarding against floating-point noise. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

/**
 * Headline counters for the dashboard hero cards.
 *
 * Runs the four aggregates concurrently. `activeTeachers` counts DISTINCT
 * `staff_id` with any usage event inside the trailing 14-day window.
 */
export async function getOverviewStats(): Promise<OverviewStats> {
  const [plansRow, activeRow, ratingRow] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        published:
          sql<number>`count(*) filter (where ${lessonPlans.status} = 'published')`.mapWith(
            Number,
          ),
      })
      .from(lessonPlans),
    db
      .select({
        active: sql<number>`count(distinct ${planUsageEvents.staffId})`.mapWith(
          Number,
        ),
      })
      .from(planUsageEvents)
      .where(
        gt(
          planUsageEvents.occurredAt,
          sql`now() - ${`${ACTIVE_WINDOW_DAYS} days`}::interval`,
        ),
      ),
    // avg() returns NULL with no rows; keep it nullable and round at the edge.
    db
      .select({ avg: sql<string | null>`avg(${planFeedback.rating})` })
      .from(planFeedback),
  ]);

  const avgRaw = ratingRow[0]?.avg;

  return {
    totalPlans: plansRow[0]?.total ?? 0,
    publishedPlans: plansRow[0]?.published ?? 0,
    activeTeachers: activeRow[0]?.active ?? 0,
    avgRating: avgRaw == null ? null : round1(Number(avgRaw)),
  };
}

// ---------------------------------------------------------------------------
// Most / least viewed
// ---------------------------------------------------------------------------

/**
 * Top plans by usage-event count, descending. Only plans with >=1 event appear
 * (an inner join), since "most viewed" with zero views is meaningless.
 */
export async function getMostViewedPlans(limit = 8): Promise<PlanViewCount[]> {
  return db
    .select({
      planId: lessonPlans.id,
      slug: lessonPlans.slug,
      title: lessonPlans.title,
      subject: lessonPlans.subject,
      grade: lessonPlans.grade,
      views: sql<number>`count(${planUsageEvents.id})`.mapWith(Number),
    })
    .from(planUsageEvents)
    .innerJoin(lessonPlans, eq(lessonPlans.id, planUsageEvents.planId))
    .groupBy(
      lessonPlans.id,
      lessonPlans.slug,
      lessonPlans.title,
      lessonPlans.subject,
      lessonPlans.grade,
    )
    .orderBy(desc(sql`count(${planUsageEvents.id})`))
    .limit(limit);
}

/**
 * Least-used PUBLISHED plans, ascending by view count.
 *
 * Uses a LEFT join from `lesson_plans` so published plans with ZERO usage
 * events are included (and surface first) — these are the real content-gap
 * candidates. Drafts are excluded; surfacing an unpublished plan as
 * "neglected" would be misleading.
 */
export async function getLeastViewedPlans(limit = 8): Promise<PlanViewCount[]> {
  return db
    .select({
      planId: lessonPlans.id,
      slug: lessonPlans.slug,
      title: lessonPlans.title,
      subject: lessonPlans.subject,
      grade: lessonPlans.grade,
      views: sql<number>`count(${planUsageEvents.id})`.mapWith(Number),
    })
    .from(lessonPlans)
    .leftJoin(planUsageEvents, eq(planUsageEvents.planId, lessonPlans.id))
    .where(eq(lessonPlans.status, "published"))
    .groupBy(
      lessonPlans.id,
      lessonPlans.slug,
      lessonPlans.title,
      lessonPlans.subject,
      lessonPlans.grade,
    )
    // ascending count, then most-recently-created so ties are deterministic.
    .orderBy(sql`count(${planUsageEvents.id}) asc`, desc(lessonPlans.createdAt))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// No-result searches (content gaps)
// ---------------------------------------------------------------------------

/**
 * Most recent searches that returned nothing, with the searcher's email.
 * A LEFT join keeps a miss even if the staff row was since deleted.
 */
export async function getNoResultSearches(
  limit = 15,
): Promise<NoResultSearch[]> {
  return db
    .select({
      id: searchMisses.id,
      query: searchMisses.query,
      occurredAt: searchMisses.occurredAt,
      searcherEmail: staff.email,
    })
    .from(searchMisses)
    .leftJoin(staff, eq(staff.id, searchMisses.staffId))
    .orderBy(desc(searchMisses.occurredAt))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Recent comments
// ---------------------------------------------------------------------------

/**
 * Most recent feedback rows that carry a non-empty comment, joined to the plan
 * (title/slug) and author email. Trims whitespace-only comments out.
 */
export async function getRecentComments(limit = 15): Promise<RecentComment[]> {
  const rows = await db
    .select({
      id: planFeedback.id,
      planId: planFeedback.planId,
      slug: lessonPlans.slug,
      title: lessonPlans.title,
      rating: planFeedback.rating,
      comment: planFeedback.comment,
      createdAt: planFeedback.createdAt,
      authorEmail: staff.email,
    })
    .from(planFeedback)
    .innerJoin(lessonPlans, eq(lessonPlans.id, planFeedback.planId))
    .leftJoin(staff, eq(staff.id, planFeedback.staffId))
    .where(
      and(
        isNotNull(planFeedback.comment),
        sql`length(trim(${planFeedback.comment})) > 0`,
      ),
    )
    .orderBy(desc(planFeedback.createdAt))
    .limit(limit);

  // `comment` is typed nullable; the WHERE guarantees it is present here.
  return rows.map((r) => ({ ...r, comment: r.comment ?? "" }));
}

// ---------------------------------------------------------------------------
// Lowest-rated plans
// ---------------------------------------------------------------------------

/**
 * Plans with the lowest mean rating, ascending. Requires at least
 * {@link MIN_FEEDBACKS_FOR_RANKING} feedback rows so a single harsh rating does
 * not dominate the board.
 */
export async function getLowestRatedPlans(
  limit = 8,
): Promise<LowestRatedPlan[]> {
  const rows = await db
    .select({
      planId: lessonPlans.id,
      slug: lessonPlans.slug,
      title: lessonPlans.title,
      // avg() yields a numeric string; round at the edge after coercion.
      avgRating: sql<string>`avg(${planFeedback.rating})`,
      feedbackCount: sql<number>`count(${planFeedback.id})`.mapWith(Number),
    })
    .from(planFeedback)
    .innerJoin(lessonPlans, eq(lessonPlans.id, planFeedback.planId))
    .groupBy(lessonPlans.id, lessonPlans.slug, lessonPlans.title)
    .having(sql`count(${planFeedback.id}) >= ${MIN_FEEDBACKS_FOR_RANKING}`)
    .orderBy(sql`avg(${planFeedback.rating}) asc`)
    .limit(limit);

  return rows.map((r) => ({
    planId: r.planId,
    slug: r.slug,
    title: r.title,
    avgRating: round1(Number(r.avgRating)),
    feedbackCount: r.feedbackCount,
  }));
}

// ---------------------------------------------------------------------------
// Feedback-hour participation
// ---------------------------------------------------------------------------

/**
 * How many feedback-hour bonuses have been awarded, and to how many distinct
 * staff. Reads the points ledger filtered to the `feedback_hour_bonus` reason.
 */
export async function getFeedbackHourParticipation(): Promise<FeedbackHourParticipation> {
  const rows = await db
    .select({
      awardCount: sql<number>`count(*)`.mapWith(Number),
      distinctStaff: sql<number>`count(distinct ${pointsLedger.staffId})`.mapWith(
        Number,
      ),
    })
    .from(pointsLedger)
    .where(eq(pointsLedger.reason, FEEDBACK_HOUR_REASON));

  return {
    awardCount: rows[0]?.awardCount ?? 0,
    distinctStaff: rows[0]?.distinctStaff ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Teacher activity (who uses the system, and how often)
// ---------------------------------------------------------------------------

/**
 * Per-teacher engagement roster across every activity signal.
 *
 * Rather than a fragile multi-source FULL OUTER JOIN, this fans out four small
 * grouped aggregates (one base list of staff + a count/max per signal) and
 * stitches them together in memory keyed by `staffId`. The merge is provably
 * identical on PGlite and PostgreSQL.
 *
 * Every staff row is returned — including teachers with zero activity, so the
 * admin can see who has *never* engaged. Sorted most-active first
 * (totalActions desc, then most-recently-active).
 */
export async function getTeacherActivity(): Promise<TeacherActivity[]> {
  const [staffRows, usageRows, feedbackRows, searchRows] = await Promise.all([
    db
      .select({
        id: staff.id,
        fullName: staff.fullName,
        email: staff.email,
        campus: staff.campus,
        lastActiveAt: staff.lastActiveAt,
      })
      .from(staff),
    db
      .select({
        staffId: planUsageEvents.staffId,
        count: sql<number>`count(*)`.mapWith(Number),
        lastAt: sql<string | null>`max(${planUsageEvents.occurredAt})`,
      })
      .from(planUsageEvents)
      .groupBy(planUsageEvents.staffId),
    db
      .select({
        staffId: planFeedback.staffId,
        count: sql<number>`count(*)`.mapWith(Number),
        lastAt: sql<string | null>`max(${planFeedback.createdAt})`,
      })
      .from(planFeedback)
      .groupBy(planFeedback.staffId),
    db
      .select({
        staffId: searchMisses.staffId,
        count: sql<number>`count(*)`.mapWith(Number),
        lastAt: sql<string | null>`max(${searchMisses.occurredAt})`,
      })
      .from(searchMisses)
      .groupBy(searchMisses.staffId),
  ]);

  const usageById = new Map(usageRows.map((r) => [r.staffId, r]));
  const feedbackById = new Map(feedbackRows.map((r) => [r.staffId, r]));
  const searchById = new Map(searchRows.map((r) => [r.staffId, r]));

  // `now()` in the active-teacher card is server-side; here we use the request
  // clock. Both resolve to "roughly now", which is all the window needs.
  const cutoff = Date.now() - ACTIVE_WINDOW_DAYS * MS_PER_DAY;

  const rows: TeacherActivity[] = staffRows.map((s) => {
    const usage = usageById.get(s.id);
    const feedback = feedbackById.get(s.id);
    const search = searchById.get(s.id);

    const planViews = usage?.count ?? 0;
    const feedbackGiven = feedback?.count ?? 0;
    const searches = search?.count ?? 0;

    // Coerce every candidate stamp to epoch-ms; max() comes back as a string on
    // the wire, `staff.lastActiveAt` as a Date — `new Date()` swallows both.
    const stamps = [s.lastActiveAt, usage?.lastAt, feedback?.lastAt, search?.lastAt]
      .filter((v): v is string | Date => v != null)
      .map((v) => new Date(v).getTime())
      .filter((t) => !Number.isNaN(t));

    const lastActiveMs = stamps.length ? Math.max(...stamps) : null;

    return {
      staffId: s.id,
      fullName: s.fullName,
      email: s.email,
      campus: s.campus,
      planViews,
      feedbackGiven,
      searches,
      totalActions: planViews + feedbackGiven + searches,
      lastActiveAt: lastActiveMs == null ? null : new Date(lastActiveMs),
      isActive: lastActiveMs != null && lastActiveMs >= cutoff,
    };
  });

  rows.sort((a, b) => {
    if (b.totalActions !== a.totalActions) {
      return b.totalActions - a.totalActions;
    }
    return (b.lastActiveAt?.getTime() ?? 0) - (a.lastActiveAt?.getTime() ?? 0);
  });

  return rows;
}

/**
 * Daily activity volume for the trailing `days` window, oldest → newest.
 *
 * Pulls the `(day, staffId)` of every action from the three signal tables (one
 * row per action), then buckets in memory: `events` = row count, and
 * `activeTeachers` = distinct staff. Days are bucketed in **UTC** (matching the
 * JS range below), and the returned series is dense — every calendar day in the
 * window is present, zero-filled where nothing happened.
 */
export async function getActivityTrend(
  days = ACTIVITY_TREND_DAYS,
): Promise<ActivityTrendDay[]> {
  const since = sql`now() - ${`${days} days`}::interval`;

  const [usage, feedback, search] = await Promise.all([
    db
      .select({
        day: sql<string>`to_char(${planUsageEvents.occurredAt} at time zone 'UTC', 'YYYY-MM-DD')`,
        staffId: planUsageEvents.staffId,
      })
      .from(planUsageEvents)
      .where(gt(planUsageEvents.occurredAt, since)),
    db
      .select({
        day: sql<string>`to_char(${planFeedback.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`,
        staffId: planFeedback.staffId,
      })
      .from(planFeedback)
      .where(gt(planFeedback.createdAt, since)),
    db
      .select({
        day: sql<string>`to_char(${searchMisses.occurredAt} at time zone 'UTC', 'YYYY-MM-DD')`,
        staffId: searchMisses.staffId,
      })
      .from(searchMisses)
      .where(gt(searchMisses.occurredAt, since)),
  ]);

  const eventsByDay = new Map<string, number>();
  const staffByDay = new Map<string, Set<string>>();

  for (const r of [...usage, ...feedback, ...search]) {
    eventsByDay.set(r.day, (eventsByDay.get(r.day) ?? 0) + 1);
    let set = staffByDay.get(r.day);
    if (!set) {
      set = new Set<string>();
      staffByDay.set(r.day, set);
    }
    if (r.staffId) set.add(r.staffId);
  }

  const out: ActivityTrendDay[] = [];
  const todayMs = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(todayMs - i * MS_PER_DAY).toISOString().slice(0, 10);
    out.push({
      day: key,
      events: eventsByDay.get(key) ?? 0,
      activeTeachers: staffByDay.get(key)?.size ?? 0,
    });
  }

  return out;
}
