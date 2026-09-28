/**
 * Prompt assembly for AI Studio v2 lesson-plan generation.
 *
 * Port of silverleaf-lesson-plans-antoine/Lesson_Plan_Silverleaf/pipeline/prompt.py
 * plus the repair-suffix logic from pipeline/generate.py `_repair_suffix`.
 *
 * Assembles the `system` + `prompt` pair from editable prompt parts, per-request
 * scheme data, and an optional repair suffix for retry attempts that failed
 * validation.
 *
 * Pure module (no `server-only`, no DB, no network).
 */
import {
  DEFAULT_PROMPT_PART_MAP,
  type PromptPartKey,
} from "./promptDefaults";

/** Optional scheme-level pacing metadata for the generation prompt. */
export interface SchemeMeta {
  weeksCount?: number | null;
  lessonsPerWeek?: number | null;
  lessonDurationMins?: number | null;
  totalLessons?: string | null;
}

/** All inputs required to assemble a full generation prompt. */
export interface BuildPromptInput {
  /** Overrides for the editable prompt parts; missing/empty keys fall back to defaults. */
  parts: Partial<Record<PromptPartKey, string>>;
  /** Scheme-of-work header context (shared what & why for the whole scheme). */
  schemeHeader: string;
  /** The specific scheme lesson to build into a full lesson plan. */
  schemeLesson: string;
  /** Target grade (e.g. "1", "7"). */
  grade: string;
  /** Target subject (e.g. "Arithmetic", "English"). */
  subject: string;
  /** Optional scheme pacing metadata (weeks, lessons/week, duration, total). */
  schemeMeta?: SchemeMeta;
  /** Source lesson index within the scheme (used to set meta.source_lesson_idx). */
  sourceIdx: number;
  /** Validation issues from a previous attempt — triggers a repair suffix. */
  repairIssues?: string[];
}

/** The assembled system message and user prompt ready for the LLM. */
export interface BuiltPrompt {
  system: string;
  prompt: string;
}

/**
 * Replace all `{{key}}` placeholders in `tmpl` with the values in `vars`.
 */
export function applyTemplate(
  tmpl: string,
  vars: Record<string, string | number>,
): string {
  return tmpl.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{{${key}}}`,
  );
}

/** Return the part value, falling back to the default when missing/empty. */
function part(
  parts: Partial<Record<PromptPartKey, string>>,
  key: PromptPartKey,
): string {
  const v = parts[key];
  return v && v.trim() ? v : DEFAULT_PROMPT_PART_MAP[key];
}

/**
 * Build the "scheme pacing context" body from the non-empty metadata fields.
 * Returns "" when nothing is known so the section can be omitted entirely.
 */
function formatPacingContext(meta: SchemeMeta | undefined): string {
  if (!meta) return "";
  const runBits: string[] = [];
  if (meta.weeksCount != null) runBits.push(`${meta.weeksCount} weeks`);
  if (meta.lessonsPerWeek != null) runBits.push(`${meta.lessonsPerWeek} lessons/week`);
  if (meta.lessonDurationMins != null) runBits.push(`${meta.lessonDurationMins} min per lesson`);

  const lines: string[] = [];
  if (runBits.length > 0) lines.push(`This scheme runs ${runBits.join(" · ")}.`);
  if (meta.totalLessons) lines.push(`Scheme total: ${meta.totalLessons}.`);
  if (meta.lessonDurationMins != null) {
    lines.push(
      `Plan this single lesson to fit one ${meta.lessonDurationMins}-minute period: ` +
        `size the teaching sequence (hook, I do, we do, you do) and the exit ticket to that time.`,
    );
  }
  return lines.join(" ");
}

/**
 * Assemble the system message and user prompt for lesson-plan generation.
 *
 * Assembly order (mirrors prompt.py `render`):
 *   system  — the system message (separate from the user prompt).
 *   prompt  — rules + blueprint + schema_note + schemeHeader + schemeLesson
 *             + task (with placeholders filled).
 *
 * If `repairIssues` is provided and non-empty, a repair suffix is appended
 * (port of generate.py `_repair_suffix`).
 */
export function buildPrompt(input: BuildPromptInput): BuiltPrompt {
  const { parts, schemeHeader, schemeLesson, grade, subject, sourceIdx, repairIssues, schemeMeta } = input;

  // System message.
  const system = part(parts, "system");

  // Build the user prompt from ordered sections.
  const sections: string[] = [];

  // 1. Pedagogical rules.
  sections.push(part(parts, "rules"));

  // 2. Blueprint exemplar.
  sections.push(
    "=== BLUEPRINT — the worked exemplar to MATCH in shape & depth (copy the structure, NEVER the content) ===\n" +
      part(parts, "blueprint"),
  );

  // 3. Schema / output contract note.
  sections.push(part(parts, "schema_note"));

  // 4. Scheme header context.
  sections.push(
    "=== SCHEME HEADER CONTEXT (shared what & why for the whole scheme) ===\n" +
      schemeHeader,
  );

  // 4b. Scheme pacing context (optional — omitted when no metadata is known).
  const pacing = formatPacingContext(schemeMeta);
  if (pacing) {
    sections.push("=== SCHEME PACING CONTEXT ===\n" + pacing);
  }

  // 5. Scheme lesson.
  sections.push(
    "=== SCHEME LESSON to build into a full lesson plan ===\n" + schemeLesson,
  );

  // 6. Task with placeholders filled.
  const taskTmpl = part(parts, "task_template");
  sections.push(applyTemplate(taskTmpl, { grade, subject, sourceIdx }));

  let prompt = sections.join("\n\n");

  // 7. Repair suffix (when retrying after validation failure).
  if (repairIssues && repairIssues.length > 0) {
    prompt +=
      "\n\n=== YOUR PREVIOUS OUTPUT FAILED VALIDATION ===\n" +
      "Fix these issues and output the corrected object only (same schema, all keys):\n" +
      repairIssues.map((i) => `- ${i}`).join("\n");
  }

  return { system, prompt };
}
