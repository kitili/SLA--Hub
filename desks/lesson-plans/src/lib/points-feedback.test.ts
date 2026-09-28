/**
 * Integration tests for submitFeedback + the points/streak read helpers,
 * against the in-memory PGlite that test/setup.ts migrates per worker.
 *
 * submitFeedback re-resolves identity via getCurrentUser() and calls
 * revalidatePath() after commit, so both are mocked here:
 *   - "@/lib/auth"  → getCurrentUser returns a user whose .id we control per
 *                     test (must match a real staff row we insert).
 *   - "next/cache"  → revalidatePath is a no-op (there's no request scope here).
 *
 * The wall clock is pinned per test with fake timers (Date only — real timers
 * stay live so PGlite's async work is unaffected). submitFeedback reads
 * `new Date()` internally, so pinning Date makes the EAT Feedback-Hour bonus
 * and the day-based streak fully deterministic: tests choose instants inside
 * or outside the [15:00, 17:00) EAT window and step across EAT calendar days.
 *
 * What we assert (the observable contract):
 *   - First feedback for (staff, plan): a `feedback_given` ledger row of +10,
 *     plus a +5 `feedback_hour_bonus` row iff inside the EAT window, and a
 *     `feedback_streak` row that advances per EAT calendar day.
 *   - Re-rating the SAME plan: updates the rating, awards NO new points, and
 *     does NOT change the streak — even on a later day.
 *   - The streak day boundary is EAT midnight, not UTC midnight.
 *
 * The pure hold/extend/reset rules themselves are unit-tested in
 * `streak.test.ts`; here we exercise them end-to-end through the action.
 */
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/lib/contracts";

/**
 * Mutable identity the mocked getCurrentUser returns. Each test sets this to a
 * freshly-inserted staff row so feedback rows never collide across tests.
 */
let currentUser: CurrentUser | null = null;

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => currentUser),
}));

// revalidatePath throws outside a Next request scope — stub to a no-op.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Imported AFTER the mocks above so the action picks up the mocked modules.
import { submitFeedback } from "@/lib/actions/feedback";
import { db } from "@/lib/db";
import { getPointsTotal, getStreak } from "@/lib/points";
import {
  feedbackStreak,
  lessonPlans,
  planFeedback,
  pointsLedger,
  staff,
  type NewLessonPlan,
} from "@/lib/db/schema";

const SLUG_PREFIX = "pointsfb";
let seq = 0;

/**
 * Pin `new Date()` to the given UTC instant. Only `Date` is faked — timers
 * (setTimeout etc.) stay real so the PGlite driver keeps working. EAT is a
 * fixed UTC+3, so e.g. 09:00Z = 12:00 EAT (outside the Feedback Hour) and
 * 12:30Z = 15:30 EAT (inside it).
 */
function pinClock(utcIso: string): void {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(utcIso));
}

/** Insert a fresh staff row and point the mocked getCurrentUser at it. */
async function actAs(): Promise<string> {
  seq += 1;
  const email = `${SLUG_PREFIX}-${seq}@silverleaf.test`;
  const [row] = await db
    .insert(staff)
    .values({ email, fullName: `Rater ${seq}` })
    .returning();
  currentUser = {
    id: row!.id,
    email,
    fullName: `Rater ${seq}`,
    isAdmin: false,
    roles: [],
    campus: null,
    jobTitle: null,
  };
  return row!.id;
}

/** Insert a minimal published plan; returns its id. */
async function makePlan(): Promise<string> {
  seq += 1;
  const slug = `${SLUG_PREFIX}-plan-${seq}`;
  const row: NewLessonPlan = {
    slug,
    filename: `${slug}.pdf`,
    grade: "G7",
    gradeNum: 7,
    subject: "Math",
    term: "1a",
    termOrdinal: 1,
    week: 1,
    lesson: 1,
    title: "Feedback fixture",
    objectives: null,
    durationMinutes: 40,
    contentMarkdown: "x",
    status: "published",
    source: "seed",
    searchText: "feedback fixture",
  };
  const [inserted] = await db.insert(lessonPlans).values(row).returning();
  return inserted!.id;
}

/** Ledger rows for a staff member, newest-irrelevant (we filter by reason). */
async function ledgerFor(staffId: string) {
  return db.select().from(pointsLedger).where(eq(pointsLedger.staffId, staffId));
}

beforeEach(() => {
  currentUser = null;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("submitFeedback — first rating", () => {
  it("awards exactly +10 outside the Feedback Hour and starts a streak of 1", async () => {
    pinClock("2026-06-24T09:00:00Z"); // 12:00 EAT — outside [15:00, 17:00)
    const staffId = await actAs();
    const planId = await makePlan();

    const res = await submitFeedback({ planId, rating: 5, comment: "Great" });
    expect(res.ok).toBe(true);
    expect(res.awardedPoints).toBe(10);
    expect(res.currentStreak).toBe(1);

    // A single feedback row was created with the given rating/comment.
    const fb = await db
      .select()
      .from(planFeedback)
      .where(and(eq(planFeedback.staffId, staffId), eq(planFeedback.planId, planId)));
    expect(fb).toHaveLength(1);
    expect(fb[0]!.rating).toBe(5);
    expect(fb[0]!.comment).toBe("Great");

    // Exactly one base award of +10 and NO Feedback-Hour bonus row.
    const rows = await ledgerFor(staffId);
    const base = rows.filter((r) => r.reason === "feedback_given");
    expect(base).toHaveLength(1);
    expect(base[0]!.points).toBe(10);
    expect(rows.filter((r) => r.reason === "feedback_hour_bonus")).toHaveLength(0);
    expect(await getPointsTotal(staffId)).toBe(10);

    // A streak row exists at currentStreak = 1 (first day).
    const streak = await getStreak(staffId);
    expect(streak.currentStreak).toBe(1);
    expect(streak.longestStreak).toBe(1);
  });

  it("adds the +5 bonus inside the Feedback Hour", async () => {
    pinClock("2026-06-24T12:30:00Z"); // 15:30 EAT — inside the window
    const staffId = await actAs();
    const planId = await makePlan();

    const res = await submitFeedback({ planId, rating: 4 });
    expect(res.ok).toBe(true);
    expect(res.awardedPoints).toBe(15);

    const rows = await ledgerFor(staffId);
    const bonus = rows.filter((r) => r.reason === "feedback_hour_bonus");
    expect(bonus).toHaveLength(1);
    expect(bonus[0]!.points).toBe(5);
    expect(await getPointsTotal(staffId)).toBe(15);
  });
});

describe("submitFeedback — re-rating is idempotent for points/streak", () => {
  it("updates the rating but awards NO new points and leaves the streak unchanged, even a day later", async () => {
    pinClock("2026-06-24T09:00:00Z");
    const staffId = await actAs();
    const planId = await makePlan();

    const first = await submitFeedback({ planId, rating: 3 });
    expect(first.ok).toBe(true);
    const totalAfterFirst = await getPointsTotal(staffId);
    const streakAfterFirst = (await getStreak(staffId)).currentStreak;
    const ledgerCountAfterFirst = (await ledgerFor(staffId)).length;

    // Re-rate the SAME plan the NEXT day: still no points, no streak advance.
    pinClock("2026-06-25T09:00:00Z");
    const second = await submitFeedback({
      planId,
      rating: 5,
      comment: "Changed my mind",
    });
    expect(second.ok).toBe(true);
    expect(second.awardedPoints).toBe(0);

    // Still exactly one feedback row, now reflecting the new rating/comment.
    const fb = await db
      .select()
      .from(planFeedback)
      .where(and(eq(planFeedback.staffId, staffId), eq(planFeedback.planId, planId)));
    expect(fb).toHaveLength(1);
    expect(fb[0]!.rating).toBe(5);
    expect(fb[0]!.comment).toBe("Changed my mind");

    // No new ledger rows, unchanged total + streak.
    expect((await ledgerFor(staffId)).length).toBe(ledgerCountAfterFirst);
    expect(await getPointsTotal(staffId)).toBe(totalAfterFirst);
    expect((await getStreak(staffId)).currentStreak).toBe(streakAfterFirst);
  });
});

describe("submitFeedback — streak day boundaries (EAT calendar days)", () => {
  it("grows on consecutive days, holds within a day, and resets after a gap", async () => {
    const staffId = await actAs();

    // Day 1: first rating → streak 1.
    pinClock("2026-06-22T09:00:00Z");
    const day1 = await submitFeedback({ planId: await makePlan(), rating: 4 });
    expect(day1.currentStreak).toBe(1);

    // Day 2: a new plan → streak extends to 2.
    pinClock("2026-06-23T09:00:00Z");
    const day2 = await submitFeedback({ planId: await makePlan(), rating: 4 });
    expect(day2.currentStreak).toBe(2);

    // Later on day 2: another NEW plan still pays +10 but holds the streak.
    pinClock("2026-06-23T10:00:00Z");
    const day2again = await submitFeedback({
      planId: await makePlan(),
      rating: 5,
    });
    expect(day2again.awardedPoints).toBe(10);
    expect(day2again.currentStreak).toBe(2);

    // Day 6 (three-day gap): streak resets to 1; the high-water mark stays.
    pinClock("2026-06-27T09:00:00Z");
    const day6 = await submitFeedback({ planId: await makePlan(), rating: 3 });
    expect(day6.currentStreak).toBe(1);
    const streak = await getStreak(staffId);
    expect(streak.currentStreak).toBe(1);
    expect(streak.longestStreak).toBe(2);
  });

  it("uses EAT midnight, not UTC midnight, as the day boundary", async () => {
    const staffId = await actAs();

    // 20:50 UTC on Jun 24 = 23:50 EAT on Jun 24 → first day of the streak.
    pinClock("2026-06-24T20:50:00Z");
    const late = await submitFeedback({ planId: await makePlan(), rating: 4 });
    expect(late.currentStreak).toBe(1);

    // 40 minutes later it is STILL Jun 24 in UTC, but 00:30 EAT on Jun 25 —
    // a new EAT day, so a fresh plan extends the streak to 2.
    pinClock("2026-06-24T21:30:00Z");
    const early = await submitFeedback({ planId: await makePlan(), rating: 4 });
    expect(early.currentStreak).toBe(2);
    expect((await getStreak(staffId)).longestStreak).toBe(2);
  });
});

describe("submitFeedback — validation & auth guards", () => {
  it("rejects an out-of-range rating without writing anything", async () => {
    const staffId = await actAs();
    const planId = await makePlan();

    const res = await submitFeedback({ planId, rating: 9 });
    expect(res).toEqual({ ok: false, error: "invalid" });

    const fb = await db
      .select()
      .from(planFeedback)
      .where(eq(planFeedback.staffId, staffId));
    expect(fb).toHaveLength(0);
    expect(await getPointsTotal(staffId)).toBe(0);
  });

  it("returns unauthenticated when there is no current user", async () => {
    currentUser = null;
    const planId = await makePlan();
    const res = await submitFeedback({ planId, rating: 4 });
    expect(res).toEqual({ ok: false, error: "unauthenticated" });
  });

  it("two different staff each get their own +10 for the same plan", async () => {
    pinClock("2026-06-24T09:00:00Z"); // outside the window → no bonus rows
    const planId = await makePlan();

    const staffA = await actAs();
    await submitFeedback({ planId, rating: 4 });

    const staffB = await actAs();
    await submitFeedback({ planId, rating: 2 });

    // Each award is independent: exactly the base +10 apiece.
    expect(await getPointsTotal(staffA)).toBe(10);
    expect(await getPointsTotal(staffB)).toBe(10);

    const streakStaffPlan = await db
      .select()
      .from(feedbackStreak)
      .where(eq(feedbackStreak.staffId, staffB));
    expect(streakStaffPlan[0]!.currentStreak).toBe(1);
  });
});
