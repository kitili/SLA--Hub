/**
 * Guards on the seeded example corpus.
 *
 * The plan page renders the branded document ONLY when a stored `content_json`
 * safeParses against `structuredLessonPlanSchema`; a single wrong key silently
 * demotes the plan to the plain-markdown fallback with no error anywhere. These
 * tests turn that silent visual regression into a failing build.
 *
 * Pure: no DB — the samples are a data module.
 */
import { describe, it, expect } from "vitest";

import { structuredLessonPlanSchema } from "@/lib/ai/lessonPlan/structuredSchema";
import { validateLessonPlan } from "@/lib/ai/lessonPlan/validate";
import { TERM_ORDINAL } from "@/lib/naming/constants";
import { buildFilename } from "@/lib/naming/format";
import { parse } from "@/lib/naming/parse";

import { SAMPLE_PLANS } from "./sampleLessonPlans";

/** `G2_Arithmetic_T1a_W2_L1` — the filename the seeder builds for a sample. */
const filenameOf = (p: (typeof SAMPLE_PLANS)[number]) =>
  buildFilename({
    grade: p.grade,
    subject: p.subject,
    term: p.term,
    week: p.week,
    lesson: p.lesson,
  });

describe("SAMPLE_PLANS", () => {
  it("is a small curated corpus", () => {
    expect(SAMPLE_PLANS.length).toBeGreaterThanOrEqual(4);
    expect(SAMPLE_PLANS.length).toBeLessThanOrEqual(6);
  });

  it.each(SAMPLE_PLANS.map((p) => [filenameOf(p), p] as const))(
    "%s parses as a canonical filename",
    (filename, plan) => {
      const parsed = parse(filename);
      expect(parsed.ok, parsed.ok ? "" : parsed.reason).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.value.week).toBe(plan.week);
      expect(parsed.value.lesson).toBe(plan.lesson);
      expect(parsed.value.termOrdinal).toBe(TERM_ORDINAL[plan.term]);
    },
  );

  it.each(SAMPLE_PLANS.map((p) => [filenameOf(p), p] as const))(
    "%s has a body the branded renderer accepts",
    (_filename, plan) => {
      const result = structuredLessonPlanSchema.safeParse(plan.structured);
      expect(
        result.success,
        result.success
          ? ""
          : result.error.issues.map((i) => `${i.path.join("/")}: ${i.message}`).join("; "),
      ).toBe(true);
    },
  );

  it.each(SAMPLE_PLANS.map((p) => [filenameOf(p), p] as const))(
    "%s passes the v2 semantic guards",
    (_filename, plan) => {
      expect(validateLessonPlan(plan.structured)).toEqual([]);
    },
  );

  it("has no duplicate filenames", () => {
    const names = SAMPLE_PLANS.map(filenameOf);
    expect(new Set(names).size).toBe(names.length);
  });

  it("keeps each (grade, subject, term) run consecutive so 'next lessons' works", () => {
    // getUpcomingForTeacher finds a successor by strictly-after (term, week,
    // lesson) within the same grade+subject. A bucket with one plan, or a gap,
    // leaves the home page with nothing to offer.
    const buckets = new Map<string, (typeof SAMPLE_PLANS)[number][]>();
    for (const p of SAMPLE_PLANS) {
      const key = `${p.grade}_${p.subject}_${p.term}`;
      buckets.set(key, [...(buckets.get(key) ?? []), p]);
    }

    for (const [key, plans] of buckets) {
      expect(plans.length, `${key} needs a successor to offer`).toBeGreaterThan(1);

      const ordered = [...plans].sort(
        (a, b) => a.week - b.week || a.lesson - b.lesson,
      );
      for (const [i, p] of ordered.entries()) {
        const prev = ordered[i - 1];
        if (!prev) {
          expect(p.lesson, `${key} first lesson of W${p.week}`).toBe(1);
          continue;
        }
        // Either the next lesson in the same week, or lesson 1 of a later week.
        const continuesWeek = p.week === prev.week && p.lesson === prev.lesson + 1;
        const startsNewWeek = p.week > prev.week && p.lesson === 1;
        expect(
          continuesWeek || startsNewWeek,
          `${key}: W${prev.week}L${prev.lesson} → W${p.week}L${p.lesson} is not consecutive`,
        ).toBe(true);
      }
    }
  });

  it("states the identifier competences the branded header prints", () => {
    for (const plan of SAMPLE_PLANS) {
      const { main_competence, specific_competence, title } = plan.structured.identifier;
      expect(title.trim()).not.toBe("");
      expect(main_competence.trim()).not.toBe("");
      expect(specific_competence.trim()).not.toBe("");
    }
  });

  it("populates watch_for_notes, which renders an empty list if left blank", () => {
    for (const plan of SAMPLE_PLANS) {
      expect(plan.structured.watch_for_notes.length).toBeGreaterThan(0);
    }
  });

  it("carries the scheme's own period length, not the generator's hardcoded 40", () => {
    // The Health & Environment scheme states 30-minute periods; Arithmetic 40.
    for (const plan of SAMPLE_PLANS) {
      const expected = plan.subject === "HealthAndEnvironment" ? 30 : 40;
      expect(plan.durationMinutes, filenameOf(plan)).toBe(expected);
    }
  });
});
