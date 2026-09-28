/**
 * The official Tanzanian (NECTA/TIE-CBC) bilingual lesson-plan form, as a view
 * model.
 *
 * This is the shape `mapPlan.ts` projects a `StructuredLessonPlan` into and
 * `ComplianceDocument.tsx` renders. It carries only the values that get FILLED:
 * the form's own bilingual labels live in the component, because they are the
 * government's form text rather than app chrome (they print in Kiswahili and
 * English together whatever the active locale).
 *
 * Fields the teacher completes BY HAND at delivery — teacher's name, date,
 * period, the pupil counts and the remarks — are deliberately absent here: they
 * are blank rules on the form, not data we hold. The per-step `time` is the same
 * kind of blank (see `mapPlan.ts`).
 *
 * Pure module (no React, no `server-only`): the switcher builds the form in the
 * client tree, and the tests import it directly.
 */

/** One of the four official steps in the LESSON PROCESS & DEVELOPMENT table. */
export type ComplianceStepRow = {
  /** The step's bilingual label exactly as printed, e.g. "KUBUNI / DESIGN". */
  step: string;
  /** MUDA / TIME — always "" for now: we hold no per-stage timing (mapPlan.ts). */
  time: string;
  /** SHUGHULI ZA UFUNDISHAJI / TEACHING ACTIVITIES — one entry per paragraph. */
  teaching: string[];
  /** SHUGHULI ZA UJIFUNZAJI / LEARNING ACTIVITIES — one entry per paragraph. */
  learning: string[];
  /** VIGEZO VYA UPIMAJI / TESTING CRITERIA — one entry per paragraph. */
  testing: string[];
};

/** Everything filled into the official form for one lesson. */
export type ComplianceForm = {
  /** JINA LA SHULE / NAME OF SCHOOL. */
  schoolName: string;
  /** UMAHIRI MKUU / MAIN COMPETENCE. */
  mainCompetence: string;
  /** SOMO / SUBJECT. */
  subject: string;
  /** DARASA / CLASS, already rendered as e.g. "Grade 2". */
  className: string;
  /** MUDA / TIME, already rendered as e.g. "40 minutes". */
  time: string;
  /** Umahiri Mahususi / Specific Competence. */
  specificCompetence: string;
  /** Shughuli Kuu / Main Activity. */
  mainActivity: string;
  /** Shughuli Mahususi / Specific Activity. */
  specificActivity: string;
  /** Zana za Ufundishaji na Ujifunzaji / Teaching Aids & Resources. */
  teachingAids: string;
  /** Rejea / Reference. */
  reference: string;
  /** The four official steps, in the order the form prints them. */
  steps: ComplianceStepRow[];
};
