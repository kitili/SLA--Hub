/**
 * applyKnownIdentifier — force a plan identifier's grade/subject/term/week/
 * lesson_number to the values the app itself derived (the scheme + naming
 * context) rather than trusting the model's own copy of them.
 *
 * The model is only asked to echo these back for its own context, and it
 * sometimes gets them wrong — e.g. computing "Term 2A" for a Week 2 lesson
 * that is actually in Term 1A. This overwrite runs in BOTH places a plan is
 * consumed: the Studio's live preview (client) and `savePlanStructured`
 * (server), so the persisted `content_json` / rendered markdown header can
 * never disagree with the filename/slug regardless of which generation path
 * (single-plan or batch) produced the plan.
 *
 * Pure module (no `server-only`) so the client preview and the server save
 * path share the exact same logic.
 */
import type { StructuredLessonPlan } from "./structuredSchema";

/** The authoritative naming coordinates the app derived for this plan. */
export interface KnownIdentifierCtx {
  /** Grade token, e.g. "G7". */
  grade: string;
  /** Subject token, e.g. "Math". */
  subject: string;
  /** Term token, one of "1a" | "1b" | "2a" | "2b" (upper-cased for display). */
  term: string;
  /** Week number within the term (1-based). */
  week: string | number;
  /** Lesson number within the week (1-based). */
  lesson: string | number;
}

/** Overwrite the model-echoed identifier coordinates with the known `ctx`. */
export function applyKnownIdentifier(
  plan: StructuredLessonPlan,
  ctx: KnownIdentifierCtx,
): StructuredLessonPlan;
export function applyKnownIdentifier(
  plan: Partial<StructuredLessonPlan>,
  ctx: KnownIdentifierCtx,
): Partial<StructuredLessonPlan>;
export function applyKnownIdentifier(
  plan: Partial<StructuredLessonPlan>,
  ctx: KnownIdentifierCtx,
): Partial<StructuredLessonPlan> {
  if (!plan.identifier) return plan;
  return {
    ...plan,
    identifier: {
      ...plan.identifier,
      grade: ctx.grade,
      subject: ctx.subject,
      term: ctx.term.toUpperCase(),
      week: String(ctx.week),
      lesson_number: String(ctx.lesson),
    },
  };
}
