/**
 * formatPlanMeta — single source of truth for the one-line plan meta shown
 * under plan titles ("Grade 7 · Math · Term 1a · Week 1 · Lesson 1 · 40 min").
 *
 * Used by the plan detail page, the home "next lessons" list, the search
 * result card, and the Feedback Hour card so the grade-token handling
 * (stored "G7" → "Grade 7") and the separator live in exactly one place.
 * Labels come from the `lpPlan.meta` i18n group — callers pass a translator
 * bound to the `lpPlan` namespace.
 *
 * Pure module (no `server-only`, no DB); the translator type is erased at
 * runtime.
 */
import type { getTranslations } from "next-intl/server";

/** Translator bound to the `lpPlan` namespace (provides the `meta.*` keys). */
type PlanMetaTranslator = Awaited<ReturnType<typeof getTranslations<"lpPlan">>>;

/** The naming fields the meta line reads — satisfied by a `LessonPlan` row. */
export interface PlanMetaFields {
  grade: string;
  subject: string;
  term: string;
  week: number;
  lesson: number;
  durationMinutes?: number | null;
}

/**
 * Build the meta line.
 *
 * - `full` (default): "Grade 7 · Math · Term 1a · Week 1 · Lesson 1 · 40 min"
 *   (the duration only when known).
 * - `short`: "Grade 7 · Math · Term 1a · Wk 1 · L1" — for compact cards.
 *
 * Grades are stored as `G<n>` tokens; those render via the localised
 * `meta.grade` label. Anything else (legacy/imported values) is shown raw.
 */
export function formatPlanMeta(
  plan: PlanMetaFields,
  t: PlanMetaTranslator,
  opts?: { variant?: "full" | "short" },
): string {
  const variant = opts?.variant ?? "full";

  const gradeLabel = /^g/i.test(plan.grade)
    ? t("meta.grade", { value: plan.grade.slice(1) })
    : plan.grade;

  const parts = [
    gradeLabel,
    plan.subject,
    t("meta.term", { value: plan.term }),
    t(variant === "short" ? "meta.weekShort" : "meta.week", { value: plan.week }),
    t(variant === "short" ? "meta.lessonShort" : "meta.lesson", { value: plan.lesson }),
  ];
  if (variant === "full" && typeof plan.durationMinutes === "number") {
    parts.push(t("meta.minutes", { value: plan.durationMinutes }));
  }
  return parts.join(" · ");
}
