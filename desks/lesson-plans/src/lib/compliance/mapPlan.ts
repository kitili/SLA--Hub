/**
 * Project a StructuredLessonPlan into the official Tanzanian (NECTA/TIE-CBC)
 * bilingual lesson-plan form.
 *
 * A DETERMINISTIC re-projection of data the generator already produced: no model
 * calls, so the government form can never disagree with the branded document
 * rendered from the same `content_json`.
 *
 * Ported from the school handover's `compliance.py` (`fill_compliance` + its
 * `_*_rows` builders; see Compliance_Handover/README.md). The handover targets
 * the pipeline's v8 JSON, which THIS app's schema has drifted from, so the
 * builders are adapted rather than copied — the mapping below is the authority:
 *
 *   v8                                    → ours
 *   learning_outcomes                     → success_criteria
 *   identifier.duration                   → lesson_plans.duration_minutes (a param)
 *   i_do.key_learning_points[]            → i_do.text          (stages are flat)
 *   we_do.rounds[]                        → we_do.text
 *   you_do.questions[] / side_group_pull  → you_do.text
 *   exit_ticket[{dok,question,answer}]    → exit_ticket (one prose string)
 *   per-stage `time`                      → (nothing — we hold no timing)
 *
 * The synthesised LEARNING ACTIVITIES prose deliberately keeps the handover's
 * wording: those are the forms the school has already accepted.
 *
 * Pure module (no React, no I/O) so the switcher can build the form client-side
 * and `mapPlan.test.ts` can assert on it directly.
 */
import type { StructuredLessonPlan } from "@/lib/ai/lessonPlan/structuredSchema";

import type { ComplianceForm, ComplianceStepRow } from "./form";

/** Hard-set on the form, exactly as the handover's SCHOOL_NAME constant. */
const SCHOOL_NAME = "Silverleaf Academy";

/**
 * Period length assumed when a plan carries none. Mirrors the same fallback in
 * `savePlanStructured`, which prefers the scheme's own stated period length.
 */
const DEFAULT_DURATION_MINUTES = 40;

/** Drop empties, then join — the handover's `_join`. */
function join(items: string[], sep = "; "): string {
  return items.filter((item) => item.trim().length > 0).join(sep);
}

/**
 * The bare grade number for the form's "Grade N".
 *
 * `identifier.grade` is inconsistent across the corpus — the seeded plans store
 * "G2" while the fixture stores "1" — and the form must print "Grade 2", never
 * "Grade G2", so strip a leading G either way.
 */
function gradeNumber(grade: string): string {
  return grade.trim().replace(/^G/i, "");
}

/**
 * How learners spend the step. Our stages record what the TEACHER does (`text`)
 * but not the learners' side, which the form asks for as its own column, so it
 * is synthesised from the stage's sentence frame — the one learner-voiced field
 * a stage carries.
 */
function learnersUse(base: string, sentenceFrame: string): string {
  const frame = sentenceFrame.trim();
  return frame ? `${base}, using the frame: “${frame}”.` : `${base}.`;
}

/**
 * Fill the official form from one plan.
 *
 * `durationMinutes` comes from the `lesson_plans` row rather than the plan JSON
 * (the schema holds no duration); pass `null` for a plan with none.
 */
export function toComplianceForm(
  plan: StructuredLessonPlan,
  durationMinutes: number | null,
): ComplianceForm {
  const id = plan.identifier;
  const ts = plan.teaching_sequence;
  const grade = gradeNumber(id.grade);
  const minutes = durationMinutes ?? DEFAULT_DURATION_MINUTES;

  const steps: ComplianceStepRow[] = [
    {
      step: "UTANGULIZI / INTRODUCTION",
      time: "",
      teaching: [ts.introduction_hook.text],
      learning: [
        learnersUse(
          "Learners observe and answer the guiding question orally",
          ts.introduction_hook.sentence_frame,
        ),
      ],
      testing: [ts.introduction_hook.checkpoint],
    },
    {
      step: "KUENDELEZA UJENZI WA UMAHIRI / COMPETENCE DEVELOPMENT",
      time: "",
      teaching: [`I Do — ${ts.i_do.text}`, `We Do — ${ts.we_do.text}`],
      learning: [
        learnersUse(
          "Learners follow the teacher's modelling, then practise together",
          ts.we_do.sentence_frame,
        ),
      ],
      testing: [join([ts.i_do.checkpoint, ts.we_do.checkpoint], "  |  ")],
    },
    {
      step: "KUBUNI / DESIGN",
      time: "",
      teaching: [ts.you_do.text],
      learning: [
        learnersUse("Learners work on the task independently", ts.you_do.sentence_frame),
      ],
      testing: [ts.you_do.checkpoint],
    },
    {
      step: "TATHMINI / ASSESSMENT",
      time: "",
      teaching: [
        `Administers the exit ticket; records evidence (${plan.assessment_method})`,
      ],
      learning: [plan.conclusion_and_exit_ticket.exit_ticket],
      testing: [plan.conclusion_and_exit_ticket.understanding],
    },
  ];

  return {
    schoolName: SCHOOL_NAME,
    mainCompetence: id.main_competence,
    subject: id.subject,
    className: `Grade ${grade}`,
    time: `${minutes} minutes`,
    specificCompetence: id.specific_competence,
    mainActivity: id.title,
    specificActivity: join(plan.success_criteria),
    teachingAids: join(plan.materials_and_prep),
    reference: `Tanzania Institute of Education (TIE) — Grade ${grade} ${id.subject} Scheme of Work`,
    steps,
  };
}
