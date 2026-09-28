/**
 * Tests for formatPlanMeta — the single owner of the plan meta line.
 *
 * The translator is stubbed with the English `lpPlan.meta` strings so the
 * assertions read like the real UI output without booting next-intl.
 */
import { describe, expect, it } from "vitest";

import { formatPlanMeta } from "./planMeta";

/** Minimal stand-in for a translator bound to the `lpPlan` namespace. */
const MESSAGES: Record<string, string> = {
  "meta.grade": "Grade {value}",
  "meta.term": "Term {value}",
  "meta.week": "Week {value}",
  "meta.lesson": "Lesson {value}",
  "meta.weekShort": "Wk {value}",
  "meta.lessonShort": "L{value}",
  "meta.minutes": "{value} min",
};

const t = ((key: string, values?: Record<string, unknown>) =>
  (MESSAGES[key] ?? key).replace("{value}", String(values?.value))) as unknown as Parameters<
  typeof formatPlanMeta
>[1];

const PLAN = {
  grade: "G7",
  subject: "Math",
  term: "1a",
  week: 1,
  lesson: 2,
  durationMinutes: 40,
};

describe("formatPlanMeta", () => {
  it("renders the full variant with a G-token grade and duration", () => {
    expect(formatPlanMeta(PLAN, t)).toBe(
      "Grade 7 · Math · Term 1a · Week 1 · Lesson 2 · 40 min",
    );
  });

  it("omits the duration when it is not a number", () => {
    expect(formatPlanMeta({ ...PLAN, durationMinutes: null }, t)).toBe(
      "Grade 7 · Math · Term 1a · Week 1 · Lesson 2",
    );
  });

  it("renders the short variant without duration", () => {
    expect(formatPlanMeta(PLAN, t, { variant: "short" })).toBe(
      "Grade 7 · Math · Term 1a · Wk 1 · L2",
    );
  });

  it("shows a grade that is not a G-token raw", () => {
    expect(formatPlanMeta({ ...PLAN, grade: "Std 7" }, t)).toBe(
      "Std 7 · Math · Term 1a · Week 1 · Lesson 2 · 40 min",
    );
  });
});
