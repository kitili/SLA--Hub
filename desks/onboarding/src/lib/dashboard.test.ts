/**
 * Unit tests for the pure dashboard helpers — computeNextStep and computePacing.
 *
 * These functions have no I/O; the entire dependency on repositories and DB
 * is in getMemberDashboard (not tested here). We import only the exports
 * that are purely computational.
 *
 * `server-only` is silenced via vitest.config.ts `conditions: ["react-server"]`.
 */
import { describe, it, expect } from "vitest";
import { computeNextStep, computePacing, computeOverallProgress, ONBOARDING_WEEKS } from "./dashboard";
import type { SectionSummary } from "./dashboard";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal SectionSummary for tests. Sensible defaults for unlocked. */
function section(overrides: Partial<SectionSummary> = {}): SectionSummary {
  return {
    id: "s1",
    number: 1,
    title: "Welcome",
    description: null,
    icon: null,
    itemsTotal: 3,
    itemsDone: 0,
    quizPassed: false,
    hasQuiz: false,
    locked: false,
    pct: 0,
    ...overrides,
  };
}

function weeksAgo(weeks: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// computeNextStep
// ---------------------------------------------------------------------------

describe("computeNextStep", () => {
  it("returns start-section for a new member (section has items, none read, not in itemsTotal? no — 0 done < 3 total → resume-reading)", () => {
    // New member: first section unlocked, 3 items, 0 done
    const result = computeNextStep([section({ itemsTotal: 3, itemsDone: 0 })]);
    expect(result.kind).toBe("resume-reading");
    expect(result.sectionId).toBe("s1");
  });

  it("returns start-section when a section has 0 items (materials pending)", () => {
    const result = computeNextStep([section({ itemsTotal: 0, itemsDone: 0 })]);
    expect(result.kind).toBe("start-section");
    expect(result.sectionId).toBe("s1");
    expect(result.sectionNumber).toBe(1);
  });

  it("returns resume-reading when some items are read but not all", () => {
    const result = computeNextStep([
      section({ itemsTotal: 5, itemsDone: 2, quizPassed: false }),
    ]);
    expect(result.kind).toBe("resume-reading");
    expect(result.sectionId).toBe("s1");
  });

  it("returns take-quiz when all items are read but checkpoint not passed", () => {
    const result = computeNextStep([
      section({ itemsTotal: 3, itemsDone: 3, quizPassed: false }),
    ]);
    expect(result.kind).toBe("take-quiz");
    expect(result.sectionId).toBe("s1");
  });

  it("skips passed sections and targets the next one", () => {
    const sections = [
      section({ id: "s1", number: 1, title: "Welcome", quizPassed: true, itemsTotal: 2, itemsDone: 2 }),
      section({ id: "s2", number: 2, title: "Policies", quizPassed: false, itemsTotal: 3, itemsDone: 0, locked: false }),
    ];
    const result = computeNextStep(sections);
    expect(result.kind).toBe("resume-reading");
    expect(result.sectionId).toBe("s2");
  });

  it("returns done when all sections are passed", () => {
    const sections = [
      section({ id: "s1", number: 1, quizPassed: true, itemsTotal: 2, itemsDone: 2 }),
      section({ id: "s2", number: 2, quizPassed: true, itemsTotal: 3, itemsDone: 3 }),
    ];
    const result = computeNextStep(sections);
    expect(result.kind).toBe("done");
    expect(result.sectionId).toBeUndefined();
  });

  it("breaks on the first locked incomplete section and returns done (no actionable step)", () => {
    // Section 1 passed; Section 2 locked (shouldn't happen in practice with correct
    // locking logic, but computeNextStep documents this break behaviour).
    const sections = [
      section({ id: "s1", number: 1, quizPassed: false, locked: true, itemsTotal: 2, itemsDone: 0 }),
      section({ id: "s2", number: 2, quizPassed: false, locked: true, itemsTotal: 3, itemsDone: 0 }),
    ];
    const result = computeNextStep(sections);
    // First section is locked → break → done
    expect(result.kind).toBe("done");
  });

  it("returns sectionTitle and sectionNumber on the result", () => {
    const s = section({ id: "welcome", number: 1, title: "Welcome", itemsTotal: 3, itemsDone: 1 });
    const result = computeNextStep([s]);
    expect(result.sectionTitle).toBe("Welcome");
    expect(result.sectionNumber).toBe(1);
  });

  it("returns done for an empty sections array", () => {
    expect(computeNextStep([]).kind).toBe("done");
  });
});

// ---------------------------------------------------------------------------
// computeOverallProgress
// ---------------------------------------------------------------------------

describe("computeOverallProgress", () => {
  it("counts item reads and checkpoints as learning steps", () => {
    const sections = [
      section({ itemsTotal: 3, itemsDone: 3, quizPassed: true }),
      section({ id: "s2", number: 2, itemsTotal: 2, itemsDone: 1, quizPassed: false }),
    ];
    const result = computeOverallProgress(sections);
    // Section 1: 4/4, Section 2: 1/3 → 5/7 ≈ 71%
    expect(result.stepsDone).toBe(5);
    expect(result.totalSteps).toBe(7);
    expect(result.overallPct).toBe(71);
    expect(result.sectionsPassed).toBe(1);
  });

  it("returns 0% when nothing is done", () => {
    const result = computeOverallProgress([
      section({ itemsTotal: 2, itemsDone: 0, quizPassed: false }),
    ]);
    expect(result.overallPct).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computePacing
// ---------------------------------------------------------------------------

describe("computePacing", () => {
  const TOTAL = 6; // typical number of sections

  it("week 0: weeksElapsed=0, expectedSectionsByNow=0, onTrack=true regardless of progress", () => {
    const now = new Date("2025-06-01T12:00:00Z");
    const startedAt = new Date(now); // started this instant
    const result = computePacing(startedAt, 0, TOTAL, now);
    expect(result.weeksElapsed).toBe(0);
    expect(result.expectedSectionsByNow).toBe(0);
    expect(result.onTrack).toBe(true); // 0 passed >= 0 expected
    expect(result.totalWeeks).toBe(ONBOARDING_WEEKS);
  });

  it("mid-journey: week 3, 3 of 6 sections passed → on track (linear midpoint)", () => {
    const now = new Date("2025-06-22T12:00:00Z");
    const startedAt = weeksAgo(3, now);
    const result = computePacing(startedAt, 3, TOTAL, now);
    // 3 weeks / 6 weeks * 6 sections = 3 expected
    expect(result.weeksElapsed).toBe(3);
    expect(result.expectedSectionsByNow).toBe(3);
    expect(result.onTrack).toBe(true);
    expect(result.sectionsPassed).toBe(3);
  });

  it("mid-journey: week 3, only 1 section passed → behind", () => {
    const now = new Date("2025-06-22T12:00:00Z");
    const startedAt = weeksAgo(3, now);
    const result = computePacing(startedAt, 1, TOTAL, now);
    expect(result.onTrack).toBe(false);
    expect(result.sectionsPassed).toBe(1);
  });

  it("week 6: all sections passed → on track (complete!)", () => {
    const now = new Date("2025-06-22T12:00:00Z");
    const startedAt = weeksAgo(ONBOARDING_WEEKS, now);
    const result = computePacing(startedAt, TOTAL, TOTAL, now);
    expect(result.weeksElapsed).toBe(ONBOARDING_WEEKS);
    expect(result.expectedSectionsByNow).toBe(TOTAL); // 100% expected
    expect(result.onTrack).toBe(true);
  });

  it("week 6: 0 sections passed → behind", () => {
    const now = new Date("2025-06-22T12:00:00Z");
    const startedAt = weeksAgo(ONBOARDING_WEEKS, now);
    const result = computePacing(startedAt, 0, TOTAL, now);
    expect(result.onTrack).toBe(false);
  });

  it("null startedAt falls back to now → weeksElapsed=0 → onTrack=true", () => {
    const now = new Date("2025-06-22T12:00:00Z");
    const result = computePacing(null, 0, TOTAL, now);
    expect(result.weeksElapsed).toBe(0);
    expect(result.onTrack).toBe(true);
  });

  it("startedAtISO is the ISO string of the effective start date", () => {
    const now = new Date("2025-06-22T12:00:00Z");
    const startedAt = weeksAgo(1, now);
    const result = computePacing(startedAt, 1, TOTAL, now);
    expect(result.startedAtISO).toBe(startedAt.toISOString());
  });

  it("totalSections is echoed back", () => {
    const now = new Date("2025-06-22T12:00:00Z");
    const result = computePacing(now, 0, 8, now);
    expect(result.totalSections).toBe(8);
  });

  it("behind at week 3 with 2/6 sections (expected 3): onTrack=false", () => {
    const now = new Date("2025-06-22T12:00:00Z");
    const startedAt = weeksAgo(3, now);
    const result = computePacing(startedAt, 2, TOTAL, now);
    expect(result.expectedSectionsByNow).toBe(3);
    expect(result.onTrack).toBe(false);
  });
});
