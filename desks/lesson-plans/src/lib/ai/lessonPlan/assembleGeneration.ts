import "server-only";

/**
 * Shared lesson-plan prompt assembly (server-side).
 *
 * Both the single-generation route (`/api/ai/generate`, streaming) and the
 * batch worker (`/api/ai/batch/lesson`, non-streaming) need the SAME inputs
 * turned into a `{ system, prompt }` pair: the admin-editable `prompt_parts`,
 * the labelled SOW scheme-lesson blob, and an optional repair suffix. This
 * module is the single source of truth for that assembly so the two paths
 * never drift.
 *
 * Pure-ish: it reads the DB (prompt parts) but performs no model call. The
 * actual `streamObject`/`generateObject` stays at the call site.
 */
import { db } from "@/lib/db";
import { promptParts } from "@/lib/db/schema";
import { buildPrompt } from "@/lib/ai/lessonPlan/buildPrompt";
import type { SchemeMeta } from "@/lib/ai/lessonPlan/buildPrompt";
import type { PromptPartKey } from "@/lib/ai/lessonPlan/promptDefaults";

/**
 * Scheme-lesson columns. All optional — the labelled blob is built from
 * whichever are present. Field names match `sow_lessons` 1:1 so a row maps
 * straight in.
 */
export interface SchemeInput {
  grade?: string;
  subject?: string;
  term?: string;
  week?: string | number;
  lessonNumber?: string | number;
  specificCompetence?: string;
  mainActivity?: string;
  lessonObjective?: string;
  knowledgeAndSkills?: string;
  assessmentEvidence?: string;
  learningActivities?: string;
  misconceptions?: string;
  differentiationSupport?: string;
  resources?: string;
  reflection?: string;
}

/** Inputs for assembling one generation prompt. */
export interface AssembleGenerationInput {
  /** Per-lesson SOW columns (the content to build a full plan from). */
  scheme?: SchemeInput;
  /** Shared scheme-of-work header (the "what & why" for the whole term). */
  schemeHeader?: string;
  /** Optional scheme pacing metadata (weeks, lessons/week, duration, total). */
  schemeMeta?: SchemeMeta;
  /** Target grade, e.g. "7" or "G7". */
  grade: string;
  /** Target subject, e.g. "Math". */
  subject: string;
  /** Source-lesson index within the scheme (for meta.source_lesson_idx). */
  sourceIdx?: number;
  /** Validation issues from a previous attempt — triggers a repair suffix. */
  repairIssues?: string[];
}

/**
 * Build a readable labelled blob from the non-empty SOW scheme columns.
 * Mirrors the Antoine pipeline lesson-blob format.
 */
export function buildSchemeLesson(scheme: SchemeInput | undefined): string {
  if (!scheme) return "";

  const lines: string[] = [];

  // Header line: ## Lesson N · Week W
  const lessonN = scheme.lessonNumber != null ? String(scheme.lessonNumber) : "";
  const weekN = scheme.week != null ? String(scheme.week) : "";
  if (lessonN || weekN) {
    const header = [lessonN && `Lesson ${lessonN}`, weekN && `Week ${weekN}`]
      .filter(Boolean)
      .join(" · ");
    lines.push(`## ${header}`);
    lines.push("");
  }

  const labelledFields: [string, string | undefined][] = [
    ["**Specific competence:**", scheme.specificCompetence],
    ["**Main activity:**", scheme.mainActivity],
    ["**Lesson objective:**", scheme.lessonObjective],
    ["**Knowledge & skills:**", scheme.knowledgeAndSkills],
    ["**Assessment / evidence:**", scheme.assessmentEvidence],
    ["**Learning activities:**", scheme.learningActivities],
    ["**Misconceptions:**", scheme.misconceptions],
    ["**Differentiation / support:**", scheme.differentiationSupport],
    ["**Resources:**", scheme.resources],
    ["**Reflection:**", scheme.reflection],
  ];

  for (const [label, value] of labelledFields) {
    if (value && value.trim()) {
      lines.push(`${label} ${value.trim()}`);
    }
  }

  return lines.join("\n");
}

/**
 * Assemble the `{ system, prompt }` pair for a lesson-plan generation: loads
 * the editable prompt parts (with overrides), builds the labelled
 * scheme-lesson blob, and delegates final assembly to {@link buildPrompt}.
 */
export async function assembleGeneration(
  input: AssembleGenerationInput,
): Promise<{ system: string; prompt: string }> {
  const grade = (input.grade ?? "").toString().trim();
  const subject = (input.subject ?? "").toString().trim();
  const sourceIdx = input.sourceIdx ?? 0;

  // (a) Load ALL prompt_parts rows. These are the only source of prompt text:
  // callers cannot pass overrides, so a request can never rewrite the prompt.
  // Editing them is an admin action in AI Studio → Settings.
  const partRows = await db.select().from(promptParts);
  const parts: Record<string, string> = {};
  for (const row of partRows) {
    parts[row.key] = row.content;
  }

  // (b) Build the labelled scheme-lesson blob.
  const schemeLesson = buildSchemeLesson(input.scheme);

  // (c) Assemble the system + user prompt pair.
  return buildPrompt({
    parts: parts as Partial<Record<PromptPartKey, string>>,
    schemeHeader: input.schemeHeader ?? "",
    schemeMeta: input.schemeMeta,
    schemeLesson,
    grade,
    subject,
    sourceIdx,
    repairIssues: input.repairIssues,
  });
}
