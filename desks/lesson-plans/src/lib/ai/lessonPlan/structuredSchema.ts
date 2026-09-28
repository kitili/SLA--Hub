/**
 * Structured lesson-plan schema (AI Studio v2).
 *
 * A faithful TypeScript/Zod port of the Antoine pipeline's `LESSON_PLAN_SCHEMA`
 * (silverleaf-lesson-plans-antoine/Lesson_Plan_Silverleaf/pipeline/schema.py —
 * an external provenance repo, not part of this codebase).
 * This is the canonical contract: the model produces it (via `streamObject`),
 * `validate.ts` enforces the semantic guards on it, the branded renderer
 * consumes it, and it is persisted to `lesson_plans.content_json`.
 *
 * Section order encodes the backwards-design chain:
 *   success_criteria (teacher "Students can" voice) → knows → shows →
 *   misconceptions → materials_and_prep → teaching_sequence → differentiation →
 *   conclusion_and_exit_ticket → assessment_method → watch_for_notes →
 *   teacher_reflection.
 *
 * The surface→deep climb is structural: hook & i_do are fixed to "Surface",
 * we_do & you_do to "Deep" (single-value enums the model cannot mislabel).
 *
 * WARNING: the plan page renders the branded document only when a stored
 * `content_json` row safeParses against THIS schema — tightening it (new
 * required fields, stricter constraints) silently demotes every previously
 * saved plan to the plain markdown fallback (`markdownToReact`).
 *
 * Pure module (no `server-only`) so it can be imported by routes, server
 * actions, the renderer, and referenced from the client for typing.
 */
import { z } from "zod";

/** A teaching stage with a fixed depth so the climb cannot be mislabelled. */
function stage<D extends "Surface" | "Deep">(depth: D) {
  return z.object({
    depth: z.literal(depth),
    /** What the teacher does/says at this stage. */
    text: z.string().min(1),
    /** Optional sentence frame learners use, e.g. "There are ___ because ___". */
    sentence_frame: z.string(),
    /** The distributed check-for-understanding question for THIS stage. */
    checkpoint: z.string().min(1),
  });
}

export const structuredLessonPlanSchema = z.object({
  /** Thin identifier — just enough to know which lesson this is. */
  identifier: z.object({
    title: z.string(),
    grade: z.string(),
    subject: z.string(),
    term: z.string(),
    week: z.string(),
    lesson_number: z.string(),
    main_competence: z.string(),
    specific_competence: z.string(),
  }),
  /**
   * Destination first — TEACHER "Students can…" voice (never child "I can").
   * Distinct from knows/shows (no lane collapse).
   */
  success_criteria: z.array(z.string()).min(1),
  /** Ideas in the head: facts, concepts. */
  knows: z.array(z.string()).min(1),
  /** What the learner can do, observably: actions. */
  shows: z.array(z.string()).min(1),
  /** Condensed, derived from knows/shows: a short lead + a description. */
  misconceptions: z
    .array(
      z.object({
        misconception: z.string(),
        description: z.string(),
      }),
    )
    .min(1),
  materials_and_prep: z.array(z.string()).min(1),
  /** Backwards-designed climb: surface (hook, i_do) → deep (we_do, you_do). */
  teaching_sequence: z.object({
    introduction_hook: stage("Surface"),
    i_do: stage("Surface"),
    we_do: stage("Deep"),
    you_do: stage("Deep"),
  }),
  /** Suggestions, not requirements; no "core"; digital is one conditional idea. */
  differentiation: z.object({
    remedial: z.string(),
    support: z.string(),
    challenge: z.string(),
    /** Exactly one suggested digital idea, labelled "(if available)". */
    digital_resources: z.array(z.string()).min(1),
  }),
  conclusion_and_exit_ticket: z.object({
    understanding: z.string(),
    /** Any short closing activity (question, riddle, game, show-me). */
    exit_ticket: z.string(),
  }),
  /** The METHOD only (observe / oral / distributed checkpoints). */
  assessment_method: z.string(),
  watch_for_notes: z.array(z.string()),
  /** Three reflection questions on the teacher's OWN teaching (enforced in validate). */
  teacher_reflection: z.array(z.string()),
  meta: z.object({
    source_lesson_idx: z.number().int(),
    grade: z.string(),
    subject: z.string(),
    gaps_flagged: z.array(z.string()),
  }),
});

/** The canonical structured lesson plan produced by AI Studio v2. */
export type StructuredLessonPlan = z.infer<typeof structuredLessonPlanSchema>;

/**
 * A single teaching stage (introduction_hook | i_do | we_do | you_do) — the
 * union of the Surface and Deep variants, so `depth` is `"Surface" | "Deep"`.
 */
export type TeachingStage =
  StructuredLessonPlan["teaching_sequence"][keyof StructuredLessonPlan["teaching_sequence"]];

/** Ordered teaching-stage keys + display labels (used by validate + renderer). */
export const TEACHING_STAGES = [
  { key: "introduction_hook", label: "Introduction / Hook" },
  { key: "i_do", label: "I Do" },
  { key: "we_do", label: "We Do" },
  { key: "you_do", label: "You Do" },
] as const;
