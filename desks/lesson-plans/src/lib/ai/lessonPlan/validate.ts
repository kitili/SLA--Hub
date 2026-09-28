/**
 * Post-generation semantic guards for v2 lesson plans (AI Studio v2).
 *
 * Port of silverleaf-lesson-plans-antoine/Lesson_Plan_Silverleaf/pipeline/validate.py.
 *
 * The Zod schema (`structuredLessonPlanSchema`) already enforces structure; these
 * guards check the semantics the schema cannot express:
 *   (a) Zod validity — surface any schema-level issues as strings.
 *   (b) Voice — success_criteria must not start with "I can" (child's voice).
 *   (c) MECE lane separation — no success_criteria is a verbatim copy of a know/show.
 *   (d) Assessment method MECE — must not restate a success criterion.
 *   (e) Distributed checkpoints — every stage must have a non-empty checkpoint.
 *   (f) Teacher reflection length — exactly 3 questions.
 *
 * Pure module (no `server-only`, no DB, no network).
 */
import {
  TEACHING_STAGES,
  type StructuredLessonPlan,
  structuredLessonPlanSchema,
} from "./structuredSchema";

/** Number of teacher-reflection questions required by the v2 guide. */
const REFLECTION_QUESTIONS = 3;

/**
 * Normalise a string for loose comparison: collapse whitespace + lowercase.
 * Mirrors `_norm()` in validate.py.
 */
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Validate a lesson plan against the v2 semantic guards.
 *
 * @returns An empty array if the plan passes all guards; otherwise a list of
 *   human-readable issue strings (one per failing guard).
 */
export function validateLessonPlan(plan: StructuredLessonPlan): string[] {
  const issues: string[] = [];

  // (a) Structural schema — surface Zod issues and bail early (downstream
  //     checks assume correct structure is present).
  const result = structuredLessonPlanSchema.safeParse(plan);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join("/") : "<root>";
      issues.push(`schema: ${path}: ${issue.message}`);
    }
    return issues;
  }

  const { success_criteria, knows, shows, teaching_sequence, teacher_reflection, assessment_method } = plan;

  // (b) Voice: success_criteria is the TEACHER's "Students can", never "I can".
  if (success_criteria.some((x) => norm(x).startsWith("i can"))) {
    issues.push(
      "voice: a success_criteria entry is in the child's 'I can' voice " +
        "(v2 requires the teacher's 'Students can ...').",
    );
  }

  // (c) MECE lane separation: no success_criteria is a verbatim Knows/Shows.
  const knowsShowsSet = new Set([...knows, ...shows].map(norm));
  if (success_criteria.some((x) => knowsShowsSet.has(norm(x)))) {
    issues.push(
      "MECE: a success_criteria entry is identical to a Knows/Shows (lane collapse).",
    );
  }

  // (d) Assessment method MECE: must not restate a success criterion outcome.
  const normAm = norm(assessment_method);
  if (success_criteria.some((x) => normAm.includes(norm(x)))) {
    issues.push(
      "MECE: assessment_method restates a success criterion (should name only the method).",
    );
  }

  // (e) Distributed checkpoints: every stage must have a non-empty checkpoint.
  for (const { key: stageKey } of TEACHING_STAGES) {
    if (!teaching_sequence[stageKey].checkpoint.trim()) {
      issues.push(
        `checkpoint empty in ${stageKey}: the assessment questions must be ` +
          "distributed one-per-stage, not left blank.",
      );
    }
  }

  // (f) Exactly three reflection questions (v2).
  const nReflect = teacher_reflection.length;
  if (nReflect !== REFLECTION_QUESTIONS) {
    issues.push(
      `teacher_reflection must have exactly ${REFLECTION_QUESTIONS} questions, got ${nReflect}.`,
    );
  }

  return issues;
}
