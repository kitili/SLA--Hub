/**
 * Integration tests for getUpcomingForTeacher against the in-memory PGlite that
 * test/setup.ts migrates per worker.
 *
 * Coverage:
 *   - With usage history: returns the published plans that come strictly AFTER
 *     the last-used plan in (termOrdinal, week, lesson) order, scoped to the
 *     same (grade, subject).
 *   - No history: falls back to the first published plans in catalogue order
 *     (gradeNum, subject, termOrdinal, week, lesson).
 *
 * Isolation: every row this file inserts is namespaced with a unique token so it
 * never collides with other DB-backed test files sharing the same PGlite.
 */
import { asc, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { buildSearchText } from "@/lib/lesson/searchText";
import { buildFilename } from "@/lib/naming/format";
import { parse } from "@/lib/naming/parse";
import {
  lessonPlans,
  planUsageEvents,
  staff,
  type NewLessonPlan,
} from "@/lib/db/schema";
import { getUpcomingForTeacher } from "./upcoming";

/** Unique namespace so rows from this file never collide with siblings. */
const NS = "upcoming";

/** Insert a staff row and return its generated UUID. */
async function makeStaff(email: string): Promise<string> {
  const [row] = await db
    .insert(staff)
    .values({ email, fullName: `Teacher ${email}` })
    .returning();
  return row!.id;
}

interface PlanSpec {
  grade: string;
  subject: string;
  term: string;
  week: number;
  lesson: number;
  slug: string;
  status?: "draft" | "published";
}

/**
 * Insert a lesson plan from a small spec. The naming fields (gradeNum,
 * termOrdinal, …) are derived by parsing a canonical filename — the same
 * parse() path seed.ts uses — but the `slug` is taken verbatim from the spec so
 * fixtures stay uniquely namespaced and isolated from other test files sharing
 * this PGlite. Returns the new plan id.
 */
async function makePlan(spec: PlanSpec): Promise<string> {
  const filename = buildFilename({
    grade: spec.grade,
    subject: spec.subject,
    term: spec.term,
    week: spec.week,
    lesson: spec.lesson,
  });
  const parsed = parse(filename);
  if (!parsed.ok) {
    throw new Error(`fixture filename "${filename}" failed to parse: ${parsed.reason}`);
  }
  const { grade, gradeNum, subject, term, termOrdinal, week, lesson } =
    parsed.value;
  // Use the caller's unique slug (NOT parsed.value.slug) for cross-file isolation.
  const slug = spec.slug;

  const title = `${subject} ${grade} ${term} w${week} l${lesson}`;
  const row: NewLessonPlan = {
    slug,
    filename: `${filename}__${slug}`,
    grade,
    gradeNum,
    subject,
    term,
    termOrdinal,
    week,
    lesson,
    title,
    topic: null,
    objectives: null,
    durationMinutes: 40,
    contentMarkdown: title,
    status: spec.status ?? "published",
    source: "seed",
    searchText: buildSearchText({ subject, grade, term, title }),
  };
  const [inserted] = await db.insert(lessonPlans).values(row).returning();
  return inserted!.id;
}

/** Record a usage event for (staff, plan) at a given instant. */
async function recordUsage(
  staffId: string,
  planId: string,
  occurredAt: Date,
): Promise<void> {
  await db
    .insert(planUsageEvents)
    .values({ staffId, planId, eventType: "open", occurredAt });
}

// Fixture ids, populated in beforeAll.
let teacherWithHistory: string;
let teacherNoHistory: string;
// G7 Math, term 1a, week 1: lessons 1..3, plus a week-2 lesson.
let g7MathW1L1: string;
let g7MathW1L2: string;
let g7MathW1L3: string;
let g7MathW2L1: string;
// A different (grade, subject) that must never leak into G7-Math results.
let g8ScienceW1L1: string;

beforeAll(async () => {
  teacherWithHistory = await makeStaff(`${NS}-hist@silverleaf.test`);
  teacherNoHistory = await makeStaff(`${NS}-fresh@silverleaf.test`);

  g7MathW1L1 = await makePlan({
    grade: "g7",
    subject: "math",
    term: "1a",
    week: 1,
    lesson: 1,
    slug: `${NS}-g7-math-w1-l1`,
  });
  g7MathW1L2 = await makePlan({
    grade: "g7",
    subject: "math",
    term: "1a",
    week: 1,
    lesson: 2,
    slug: `${NS}-g7-math-w1-l2`,
  });
  g7MathW1L3 = await makePlan({
    grade: "g7",
    subject: "math",
    term: "1a",
    week: 1,
    lesson: 3,
    slug: `${NS}-g7-math-w1-l3`,
  });
  g7MathW2L1 = await makePlan({
    grade: "g7",
    subject: "math",
    term: "1a",
    week: 2,
    lesson: 1,
    slug: `${NS}-g7-math-w2-l1`,
  });
  g8ScienceW1L1 = await makePlan({
    grade: "g8",
    subject: "science",
    term: "1a",
    week: 1,
    lesson: 1,
    slug: `${NS}-g8-science-w1-l1`,
  });
});

describe("getUpcomingForTeacher — with usage history", () => {
  it("returns plans strictly after the last-used one in (term,week,lesson) order, same grade+subject", async () => {
    // Last used: G7 Math w1 l1 (most recent event).
    await recordUsage(teacherWithHistory, g7MathW1L2, new Date("2026-01-01T08:00:00Z"));
    await recordUsage(teacherWithHistory, g7MathW1L1, new Date("2026-02-01T08:00:00Z"));

    const next = await getUpcomingForTeacher(teacherWithHistory, 10);
    const ids = next.map((p) => p.id);

    // Strictly after w1 l1: w1 l2, w1 l3, w2 l1 — in that order.
    expect(ids).toEqual([g7MathW1L2, g7MathW1L3, g7MathW2L1]);
    // The anchor itself is excluded, and the other subject never appears.
    expect(ids).not.toContain(g7MathW1L1);
    expect(ids).not.toContain(g8ScienceW1L1);
  });

  it("honours the limit", async () => {
    const next = await getUpcomingForTeacher(teacherWithHistory, 2);
    expect(next.map((p) => p.id)).toEqual([g7MathW1L2, g7MathW1L3]);
  });
});

describe("getUpcomingForTeacher — no history fallback", () => {
  it("returns the first published plans in catalogue order", async () => {
    const next = await getUpcomingForTeacher(teacherNoHistory, 3);
    expect(next).toHaveLength(3);

    // Catalogue order is (gradeNum, subject, termOrdinal, week, lesson). Other
    // test files seed published plans into this shared PGlite too, so rather
    // than assert exact ids we assert the function returns exactly the DB's own
    // first-N published rows in that same order. Comparing against a DB query
    // (not a JS comparator) keeps the assertion correct regardless of how the
    // `subject` text column collates.
    const expected = await db
      .select({ id: lessonPlans.id })
      .from(lessonPlans)
      .where(eq(lessonPlans.status, "published"))
      .orderBy(
        asc(lessonPlans.gradeNum),
        asc(lessonPlans.subject),
        asc(lessonPlans.termOrdinal),
        asc(lessonPlans.week),
        asc(lessonPlans.lesson),
      )
      .limit(3);

    expect(next.map((p) => p.id)).toEqual(expected.map((r) => r.id));
  });

  it("anchors on a DRAFT last-used plan and returns published plans after it (same grade+subject)", async () => {
    // Last-used plan is a DRAFT. The anchor lookup loads it by id WITHOUT a
    // status filter (upcoming.ts only degrades to the catalogue head when the
    // anchor row is ABSENT), so it is used as a normal cursor. Published plans
    // in the same (grade, subject) strictly after it are returned.
    //
    // NOTE FOR INTEGRATOR: upcoming.ts's docstring says it degrades "deleted /
    // unpublished" anchors to the catalogue head, but the code only handles the
    // *deleted* (row absent) case — an unpublished anchor is still used. (That
    // absent-row branch is also effectively unreachable while the
    // plan_usage_events.plan_id FK holds.) This test documents the ACTUAL
    // behaviour; flagged, not fixed.
    const teacher = await makeStaff(`${NS}-draft@silverleaf.test`);
    const draftAnchor = await makePlan({
      grade: "g9",
      subject: "history",
      term: "1a",
      week: 1,
      lesson: 1,
      slug: `${NS}-g9-history-draft-anchor`,
      status: "draft",
    });
    const afterPublished = await makePlan({
      grade: "g9",
      subject: "history",
      term: "1a",
      week: 1,
      lesson: 2,
      slug: `${NS}-g9-history-w1-l2`,
      status: "published",
    });
    await recordUsage(teacher, draftAnchor, new Date("2026-03-01T08:00:00Z"));

    const next = await getUpcomingForTeacher(teacher, 3);
    const ids = next.map((p) => p.id);
    // The published plan strictly after the draft anchor is surfaced…
    expect(ids).toContain(afterPublished);
    // …the draft anchor itself never is, and all results are published.
    expect(ids).not.toContain(draftAnchor);
    expect(next.every((p) => p.status === "published")).toBe(true);
  });
});
