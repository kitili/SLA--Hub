/**
 * Integration tests for the teacher-activity insights, run against the
 * in-memory PGlite instance (migrations applied by test/setup.ts). These prove
 * the aggregate SQL — `max()`, `to_char(... at time zone 'UTC')`, interval
 * windows — executes on the embedded driver, and that the in-memory merge logic
 * is correct.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  lessonPlans,
  planFeedback,
  planUsageEvents,
  searchMisses,
  staff,
} from "@/lib/db/schema";
import { getActivityTrend, getTeacherActivity } from "./insights";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Insert a minimal published plan and return its id. */
async function insertPlan(slug: string): Promise<string> {
  const [row] = await db
    .insert(lessonPlans)
    .values({
      slug,
      filename: `${slug}.md`,
      grade: "G7",
      gradeNum: 7,
      subject: "Math",
      term: "Term 1",
      termOrdinal: 1,
      week: 1,
      lesson: 1,
      title: "Test Plan",
      contentMarkdown: "x",
      searchText: "x",
    })
    .returning();
  return row!.id;
}

describe("teacher-activity insights", () => {
  beforeEach(async () => {
    // FK-safe order: children first, then plans, then staff.
    await db.delete(planUsageEvents);
    await db.delete(planFeedback);
    await db.delete(searchMisses);
    await db.delete(lessonPlans);
    await db.delete(staff);
  });

  it("aggregates per-teacher counts, totals, last-active and sorts most-active first", async () => {
    const now = new Date();
    const old = new Date(now.getTime() - 30 * DAY_MS);

    const alice = (
      await db
        .insert(staff)
        .values({ email: "alice@x.co", fullName: "Active Alice" })
        .returning()
    )[0]!;
    const bob = (
      await db
        .insert(staff)
        .values({ email: "bob@x.co", fullName: "Dormant Bob", lastActiveAt: old })
        .returning()
    )[0]!;

    const planId = await insertPlan("plan-1");

    await db.insert(planUsageEvents).values([
      { staffId: alice.id, planId, eventType: "view", occurredAt: now },
      { staffId: alice.id, planId, eventType: "open", occurredAt: now },
      { staffId: bob.id, planId, eventType: "view", occurredAt: old },
    ]);
    await db
      .insert(planFeedback)
      .values({ staffId: alice.id, planId, rating: 5, createdAt: now, updatedAt: now });
    await db
      .insert(searchMisses)
      .values({ staffId: alice.id, query: "fractions", occurredAt: now });

    const roster = await getTeacherActivity();

    expect(roster).toHaveLength(2);

    // Most-active first.
    const first = roster[0]!;
    const second = roster[1]!;
    expect(first.fullName).toBe("Active Alice");
    expect(first.planViews).toBe(2);
    expect(first.feedbackGiven).toBe(1);
    expect(first.searches).toBe(1);
    expect(first.totalActions).toBe(4);
    expect(first.isActive).toBe(true);
    expect(first.lastActiveAt).not.toBeNull();

    expect(second.fullName).toBe("Dormant Bob");
    expect(second.planViews).toBe(1);
    expect(second.totalActions).toBe(1);
    expect(second.isActive).toBe(false);
  });

  it("returns a dense UTC day series excluding events outside the window", async () => {
    const now = new Date();
    const old = new Date(now.getTime() - 30 * DAY_MS);

    const alice = (
      await db
        .insert(staff)
        .values({ email: "alice@x.co", fullName: "Active Alice" })
        .returning()
    )[0]!;
    const planId = await insertPlan("plan-1");

    await db.insert(planUsageEvents).values([
      { staffId: alice.id, planId, eventType: "view", occurredAt: now },
      { staffId: alice.id, planId, eventType: "open", occurredAt: now },
      // 30 days ago — outside the 14-day window, must not be counted.
      { staffId: alice.id, planId, eventType: "view", occurredAt: old },
    ]);
    await db
      .insert(planFeedback)
      .values({ staffId: alice.id, planId, rating: 4, createdAt: now, updatedAt: now });
    await db
      .insert(searchMisses)
      .values({ staffId: alice.id, query: "decimals", occurredAt: now });

    const trend = await getActivityTrend();

    expect(trend).toHaveLength(14);

    const totalEvents = trend.reduce((sum, d) => sum + d.events, 0);
    expect(totalEvents).toBe(4); // 2 usage + 1 feedback + 1 search; old one excluded

    const today = new Date().toISOString().slice(0, 10);
    const todayBucket = trend.find((d) => d.day === today);
    expect(todayBucket?.events).toBe(4);
    expect(todayBucket?.activeTeachers).toBe(1);
  });
});
