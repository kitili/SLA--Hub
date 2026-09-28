/**
 * Shared client types for the AI Studio (single-plan) multi-panel UI.
 *
 * These mirror the server-action return shapes (see src/lib/actions/*) but are
 * kept lightweight and serialisable so they can flow through React state and
 * across the panel sub-components without importing server-only modules.
 *
 * The `LessonColumns` / `LESSON_COLUMN_KEYS` metadata is also the canonical
 * column set for the schemes admin (schemes/LessonEditForm) — extend it here
 * and every column-driven form/label stays in sync.
 */
import type { StructuredLessonPlan } from "@/lib/ai/lessonPlan/structuredSchema";

/**
 * A possibly-incomplete structured plan, as accumulated from the generation
 * stream and edited in the studio. Shared by the studio client, the preview
 * pane, and the structured editor so all three agree on the draft shape.
 */
export type Draft = Partial<StructuredLessonPlan>;

/** The 10 editable SOW lesson columns the generator consumes. */
export interface LessonColumns {
  specificCompetence: string;
  mainActivity: string;
  lessonObjective: string;
  knowledgeAndSkills: string;
  assessmentEvidence: string;
  learningActivities: string;
  misconceptions: string;
  differentiationSupport: string;
  resources: string;
  reflection: string;
}

/** Ordered metadata for rendering the 10 columns as labelled fields. */
export const LESSON_COLUMN_KEYS = [
  "specificCompetence",
  "mainActivity",
  "lessonObjective",
  "knowledgeAndSkills",
  "assessmentEvidence",
  "learningActivities",
  "misconceptions",
  "differentiationSupport",
  "resources",
  "reflection",
] as const satisfies ReadonlyArray<keyof LessonColumns>;

export const EMPTY_COLUMNS: LessonColumns = {
  specificCompetence: "",
  mainActivity: "",
  lessonObjective: "",
  knowledgeAndSkills: "",
  assessmentEvidence: "",
  learningActivities: "",
  misconceptions: "",
  differentiationSupport: "",
  resources: "",
  reflection: "",
};

/** A scheme-of-work summary row, as returned by `listSchemes`. */
export interface SchemeSummary {
  id: string;
  title: string;
  /** Raw grade label as parsed from the scheme, e.g. "Grade 2" — display only. */
  grade: string;
  /** Numeric grade, e.g. `2`. Use this (as `G${gradeNum}`) for the `PlanContext` token. */
  gradeNum: number;
  subject: string;
  term: string;
  rowCount: number;
}

/** A SOW lesson row, as returned by `getScheme().lessons`. */
export interface SchemeLessonRow extends Partial<LessonColumns> {
  id: string;
  orderIndex: number;
  week: number | null;
  lessonNumber: string | null;
}

/** A prompt part as returned by `listPromptParts`. */
export interface PromptPartRow {
  key: string;
  label: string;
  content: string;
}

/** The naming context the user supplies for save/generate. */
export interface PlanContext {
  grade: string;
  subject: string;
  term: string;
  week: string;
  lesson: string;
}
