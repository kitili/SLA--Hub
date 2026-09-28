/**
 * Tests for `savePlanStructured`'s normalisation rules against the in-memory
 * PGlite that test/setup.ts migrates per worker.
 *
 * Coverage:
 *   - an unrecognised term is REJECTED (not silently coerced to "1a");
 *   - grade/subject tokens are normalised for filename/slug derivation
 *     (bare digits gain the "G" prefix; multi-word subjects TitleCase into a
 *     single token) and un-normalisable grades are rejected — the "GNaN"
 *     regression fixed in 321af50;
 *   - the model-echoed identifier coordinates are overwritten with the
 *     caller's naming context before persisting (content_json + title/topic
 *     must agree with the filename/slug on both generation paths).
 *
 * `requireAdmin` and `revalidatePath` are mocked: the action re-asserts admin
 * from session state and revalidates routes, neither of which exists in the
 * test process. Everything else (validation, normalisation, insert) is real.
 */
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { VALID_PLAN } from "../../../test/fixtures/structuredPlan";

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { lessonPlans, schemesOfWork, sowLessons, staff } from "@/lib/db/schema";
import type { CurrentUser } from "@/lib/contracts";
import type { StructuredLessonPlan } from "@/lib/ai/lessonPlan/structuredSchema";
import { savePlanStructured } from "./aiStudio";

beforeAll(async () => {
  // The inserted plan row FKs `created_by` → staff, so back the mocked admin
  // with a real row and point the mock at its generated id.
  const [admin] = await db
    .insert(staff)
    .values({ email: "aistudio-test@silverleaf.test", fullName: "Studio Tester" })
    .returning();
  const user: CurrentUser = {
    id: admin!.id,
    email: "aistudio-test@silverleaf.test",
    fullName: "Studio Tester",
    isAdmin: true,
    roles: [],
    campus: null,
    jobTitle: null,
  };
  vi.mocked(requireAdmin).mockResolvedValue(user);
});

describe("savePlanStructured — term normalisation", () => {
  it("rejects an unrecognised term instead of silently coercing it", async () => {
    const res = await savePlanStructured(VALID_PLAN, {
      grade: "G1",
      subject: "Arithmetic",
      term: "Term 2A", // raw SOW column value that never got normalised
      week: 1,
      lesson: 1,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("invalid-input");
    // The authored safe detail travels in `message` (never raw exceptions).
    expect(res.message).toMatch(/Unrecognised term "Term 2A"/);
    expect(res.message).toContain("1a, 1b, 2a, 2b");
  });

  it("accepts a valid term case-insensitively", async () => {
    const res = await savePlanStructured(
      VALID_PLAN,
      { grade: "G1", subject: "Arithmetic", term: " 1A ", week: 1, lesson: 1 },
      { publish: false },
    );
    expect(res.ok).toBe(true);
    expect(res.slug).toContain("t1a");
  });
});

describe("savePlanStructured — grade & subject normalisation", () => {
  it("normalises a bare-digit grade to G<n> in the row, filename, and slug", async () => {
    const res = await savePlanStructured(
      VALID_PLAN,
      { grade: "7", subject: "Math", term: "1a", week: 3, lesson: 2 },
      { publish: false },
    );
    expect(res.ok).toBe(true);
    expect(res.slug).toMatch(/^g7-math-t1a-w3-l2/);

    const [row] = await db
      .select()
      .from(lessonPlans)
      .where(eq(lessonPlans.id, res.planId!));
    expect(row!.grade).toBe("G7");
    expect(row!.gradeNum).toBe(7);
    expect(row!.filename).toBe("G7_Math_T1a_W3_L2");
  });

  it("TitleCases a multi-word subject into a single readable token", async () => {
    // "Health and Environment" must become "HealthAndEnvironment" (every word
    // capitalised), never "Healthandenvironment" — the WHY comment in the
    // action carries the rationale; this pins it.
    const res = await savePlanStructured(
      VALID_PLAN,
      {
        grade: "G2",
        subject: "Health and Environment",
        term: "2b",
        week: 1,
        lesson: 1,
      },
      { publish: false },
    );
    expect(res.ok).toBe(true);

    const [row] = await db
      .select()
      .from(lessonPlans)
      .where(eq(lessonPlans.id, res.planId!));
    expect(row!.subject).toBe("HealthAndEnvironment");
    expect(row!.filename).toBe("G2_HealthAndEnvironment_T2b_W1_L1");
    expect(res.slug).toMatch(/^g2-healthandenvironment-t2b-w1-l1/);
  });

  it("rejects a grade label that cannot become G<n> instead of saving GNaN", async () => {
    // A raw SOW label like "Grade 2" is not a valid grade token here: callers
    // normalise before saving (321af50), and the filename parse guard makes
    // sure a bad token fails loudly instead of persisting a "GNaN" filename.
    const res = await savePlanStructured(VALID_PLAN, {
      grade: "Grade 2",
      subject: "Arithmetic",
      term: "1a",
      week: 1,
      lesson: 1,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("invalid-input");
    expect(res.message).toContain("does not match Grade_Subject_Term_Week_Lesson");
  });
});

describe("savePlanStructured — lesson duration", () => {
  /**
   * Insert a scheme (with the given stated period length) plus one lesson row,
   * returning the `sow_lessons` id a caller would pass as `schemeLessonId`.
   */
  async function seedSchemeLesson(
    lessonDurationMins: number | null,
  ): Promise<string> {
    const [scheme] = await db
      .insert(schemesOfWork)
      .values({
        title: "Grade 2 Health and Environment — Term 1A",
        grade: "Grade 2",
        gradeNum: 2,
        subject: "HealthAndEnvironment",
        term: "1a",
        termOrdinal: 1,
        lessonDurationMins,
      })
      .returning();
    const [lesson] = await db
      .insert(sowLessons)
      .values({ schemeId: scheme!.id, orderIndex: 0 })
      .returning();
    return lesson!.id;
  }

  /** The saved row's `duration_minutes`, looked up by plan id. */
  async function savedDuration(planId: string): Promise<number | null> {
    const [row] = await db
      .select()
      .from(lessonPlans)
      .where(eq(lessonPlans.id, planId));
    return row!.durationMinutes;
  }

  it("carries the scheme's own period length instead of a hardcoded 40", async () => {
    // A 30-minute scheme (e.g. Health & Environment) must not have its plans
    // claim 40 min on the detail-page meta line. Both generation paths funnel
    // through this action with `schemeLessonId`, so deriving the duration here
    // covers the single-plan Studio flow AND the batch route.
    const schemeLessonId = await seedSchemeLesson(30);
    const res = await savePlanStructured(
      VALID_PLAN,
      {
        grade: "G2",
        subject: "HealthAndEnvironment",
        term: "1a",
        week: 4,
        lesson: 1,
        schemeLessonId,
      },
      { publish: false },
    );
    expect(res.ok).toBe(true);
    expect(await savedDuration(res.planId!)).toBe(30);
  });

  it("falls back to 40 when the scheme states no duration", async () => {
    // `lesson_duration_mins` is nullable — a scheme whose metadata grid omits
    // the period length keeps the previous default rather than saving null.
    const schemeLessonId = await seedSchemeLesson(null);
    const res = await savePlanStructured(
      VALID_PLAN,
      {
        grade: "G2",
        subject: "HealthAndEnvironment",
        term: "1a",
        week: 5,
        lesson: 1,
        schemeLessonId,
      },
      { publish: false },
    );
    expect(res.ok).toBe(true);
    expect(await savedDuration(res.planId!)).toBe(40);
  });

  it("falls back to 40 when the plan is not linked to a scheme lesson", async () => {
    // The Studio allows saving without a SOW row selected; there is no scheme
    // to ask, so the default stands.
    const res = await savePlanStructured(
      VALID_PLAN,
      { grade: "G2", subject: "HealthAndEnvironment", term: "1a", week: 6, lesson: 1 },
      { publish: false },
    );
    expect(res.ok).toBe(true);
    expect(await savedDuration(res.planId!)).toBe(40);
  });
});

describe("savePlanStructured — identifier normalisation", () => {
  it("overwrites the model-echoed identifier with the naming context", async () => {
    // Model echoed the WRONG term/week (the exact drift applyKnownIdentifier
    // exists to fix); the save must persist the app-derived coordinates.
    const echoed: StructuredLessonPlan = {
      ...VALID_PLAN,
      identifier: {
        ...VALID_PLAN.identifier,
        grade: "9",
        term: "2A",
        week: "Week 9",
        lesson_number: "9",
      },
    };
    const res = await savePlanStructured(
      echoed,
      { grade: "G1", subject: "Arithmetic", term: "1b", week: 2, lesson: 3 },
      { publish: false },
    );
    expect(res.ok).toBe(true);

    const [row] = await db
      .select()
      .from(lessonPlans)
      .where(eq(lessonPlans.id, res.planId!));
    expect(row).toBeDefined();
    const saved = row!.contentJson as StructuredLessonPlan;
    expect(saved.identifier.grade).toBe("G1");
    expect(saved.identifier.term).toBe("1B");
    expect(saved.identifier.week).toBe("2");
    expect(saved.identifier.lesson_number).toBe("3");
    // The rendered markdown header carries the corrected coordinates too.
    expect(row!.contentMarkdown).toContain("G1 · Arithmetic");
    expect(row!.term).toBe("1b");
    expect(row!.week).toBe(2);
    expect(row!.lesson).toBe(3);
  });
});
