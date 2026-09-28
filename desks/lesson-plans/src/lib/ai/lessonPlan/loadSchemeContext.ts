import "server-only";

/**
 * Shared SOW-lesson context loading for lesson-plan generation.
 *
 * Both generation routes (`/api/ai/generate` streaming, `/api/ai/batch/lesson`
 * buffered) start from a `sow_lessons` row id and need the same derived
 * bundle: the lesson's columns as a `SchemeInput`, the parent scheme's
 * formatted header + pacing metadata for the prompt, and normalised naming
 * tokens for `savePlanStructured`. This module is the single place that
 * lookup and normalisation happen so the two routes never drift.
 */
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { schemesOfWork, sowLessons } from "@/lib/db/schema";
import { formatSchemeHeader } from "@/lib/sow/types";

import type { SchemeInput } from "./assembleGeneration";
import type { SchemeMeta } from "./buildPrompt";

/** First run of digits in a string → int, else `fallback`. */
function digitsOr(value: string | null | undefined, fallback: number): number {
  const m = (value ?? "").match(/\d+/);
  return m ? parseInt(m[0], 10) : fallback;
}

/**
 * Normalised naming tokens for `savePlanStructured` / prompt assembly,
 * derived once from the scheme + lesson row.
 */
export interface SchemeLessonNaming {
  /**
   * Grade token, e.g. "G2". `scheme.grade` is the raw display label (e.g.
   * "Grade 2"), which `savePlanStructured`'s grade normaliser can't parse
   * (it only strips a single leading "G"/"g"). Use `gradeNum` — the same
   * `G<n>` token the single-plan Studio flow derives — so filenames don't
   * come out as "GNaN_..." and prompts don't read "Grade Grade 2".
   */
  grade: string;
  subject: string;
  /** Raw term label from the scheme (validated/lowercased at save time). */
  term: string;
  /** Week number within the term (1-based; defaults to 1 when unset). */
  week: number;
  /**
   * Lesson number within the week. `lessonNumber` is a free-text label as
   * printed in the scheme (e.g. "1", but sometimes messier like
   * "L1 Wk2 · P1") — the first run of digits wins, falling back to the
   * row's order index.
   */
  lesson: number;
}

/** Everything generation needs from a SOW lesson + its parent scheme. */
export interface SchemeLessonContext {
  /** The lesson's columns in the shared prompt-assembly shape. */
  schemeInput: SchemeInput;
  /** Formatted scheme header (the "what & why" for the whole term). */
  schemeHeader: string;
  /** Scheme pacing metadata (weeks, lessons/week, duration, total). */
  schemeMeta: SchemeMeta;
  /** Normalised naming tokens for save/prompt. */
  naming: SchemeLessonNaming;
  /** Source-lesson index within the scheme (for meta.source_lesson_idx). */
  sourceIdx: number;
}

/**
 * Load a `sow_lessons` row and its parent scheme, returning the derived
 * generation context — or `null` when the lesson (or its scheme) does not
 * exist.
 */
export async function loadSchemeLessonContext(
  schemeLessonId: string,
): Promise<SchemeLessonContext | null> {
  const lessonRows = await db
    .select()
    .from(sowLessons)
    .where(eq(sowLessons.id, schemeLessonId))
    .limit(1);
  const lesson = lessonRows[0];
  if (!lesson) return null;

  const schemeRows = await db
    .select()
    .from(schemesOfWork)
    .where(eq(schemesOfWork.id, lesson.schemeId))
    .limit(1);
  const scheme = schemeRows[0];
  if (!scheme) return null;

  const week = lesson.week ?? 1;
  const lessonNum = digitsOr(lesson.lessonNumber, lesson.orderIndex + 1);

  // Map the SOW lesson columns → the shared SchemeInput shape (names match 1:1).
  const schemeInput: SchemeInput = {
    grade: scheme.grade,
    subject: scheme.subject,
    term: scheme.term,
    week,
    lessonNumber: lessonNum,
    specificCompetence: lesson.specificCompetence ?? undefined,
    mainActivity: lesson.mainActivity ?? undefined,
    lessonObjective: lesson.lessonObjective ?? undefined,
    knowledgeAndSkills: lesson.knowledgeAndSkills ?? undefined,
    assessmentEvidence: lesson.assessmentEvidence ?? undefined,
    learningActivities: lesson.learningActivities ?? undefined,
    misconceptions: lesson.misconceptions ?? undefined,
    differentiationSupport: lesson.differentiationSupport ?? undefined,
    resources: lesson.resources ?? undefined,
    reflection: lesson.reflection ?? undefined,
  };

  return {
    schemeInput,
    schemeHeader: formatSchemeHeader(scheme.headerContext),
    schemeMeta: {
      weeksCount: scheme.weeksCount,
      lessonsPerWeek: scheme.lessonsPerWeek,
      lessonDurationMins: scheme.lessonDurationMins,
      totalLessons: scheme.totalLessons,
    },
    naming: {
      grade: `G${scheme.gradeNum}`,
      subject: scheme.subject,
      term: scheme.term,
      week,
      lesson: lessonNum,
    },
    sourceIdx: lesson.orderIndex,
  };
}
