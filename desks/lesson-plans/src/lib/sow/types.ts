/**
 * Scheme-of-Work shared types (AI Studio v2) — PURE: no DB, no network, no `ai`.
 *
 * The revised "Understanding by Design" (UbD) SOW template carries a rich
 * curriculum header above the weekly lesson tables: a transfer goal, enduring
 * understandings, essential questions, a knowledge/skills inventory, performance
 * tasks, and an assessment plan. We capture that as a {@link SchemeHeaderContext}
 * stored in `schemes_of_work.header_context` (jsonb) and inject it — formatted by
 * {@link formatSchemeHeader} — into the lesson-generation prompt's
 * "SCHEME HEADER CONTEXT" slot.
 *
 * @see ./parse.ts — produces these from an uploaded docx.
 * @see ../ai/lessonPlan/buildPrompt.ts — consumes the formatted header.
 */

/** The structured curriculum header parsed from a revised UbD scheme. */
export interface SchemeHeaderContext {
  /** The single transfer goal sentence(s). */
  transferGoal?: string;
  /** Enduring understandings (U1…/EU1…). */
  enduringUnderstandings: string[];
  /** Essential questions (EQ1…). */
  essentialQuestions: string[];
  /** Knowledge inventory (K1…). */
  knowledge: string[];
  /** Skills inventory (S1…). */
  skills: string[];
  /** Performance tasks — title + brief, one entry per task. */
  performanceTasks: string[];
  /** Formative / summative assessment plan, when present. */
  assessment?: { formative: string[]; summative: string[] };
  /** Free-text specific competences from the metadata block. */
  specificCompetences?: string;
  /** Related 21st-century skills from the metadata block. */
  relatedSkills?: string;
}

/** An empty header context — used when a source (e.g. CSV) carries no UbD header. */
export function emptySchemeHeaderContext(): SchemeHeaderContext {
  return {
    enduringUnderstandings: [],
    essentialQuestions: [],
    knowledge: [],
    skills: [],
    performanceTasks: [],
  };
}

/** True when a header context carries no usable content (all sections empty). */
export function isEmptyHeaderContext(ctx: SchemeHeaderContext | null | undefined): boolean {
  if (!ctx) return true;
  return (
    !ctx.transferGoal &&
    !ctx.specificCompetences &&
    !ctx.relatedSkills &&
    ctx.enduringUnderstandings.length === 0 &&
    ctx.essentialQuestions.length === 0 &&
    ctx.knowledge.length === 0 &&
    ctx.skills.length === 0 &&
    ctx.performanceTasks.length === 0 &&
    (ctx.assessment?.formative.length ?? 0) === 0 &&
    (ctx.assessment?.summative.length ?? 0) === 0
  );
}

/** Render a labelled list section, or "" when the list is empty. */
function listSection(label: string, items: string[]): string {
  if (!items || items.length === 0) return "";
  return `**${label}:**\n` + items.map((i) => `- ${i}`).join("\n");
}

/**
 * Format a {@link SchemeHeaderContext} as clean labelled markdown for the
 * generation prompt. Mirrors the labelled style of `buildSchemeLesson`. Empty
 * sections are omitted; an entirely empty context yields "".
 */
export function formatSchemeHeader(
  ctx: SchemeHeaderContext | null | undefined,
): string {
  if (isEmptyHeaderContext(ctx)) return "";
  const c = ctx as SchemeHeaderContext;

  const sections: string[] = [];

  if (c.specificCompetences?.trim()) {
    sections.push(`**Specific competences:** ${c.specificCompetences.trim()}`);
  }
  if (c.transferGoal?.trim()) {
    sections.push(`**Transfer goal:** ${c.transferGoal.trim()}`);
  }
  sections.push(listSection("Enduring understandings", c.enduringUnderstandings));
  sections.push(listSection("Essential questions", c.essentialQuestions));
  sections.push(listSection("Knowledge", c.knowledge));
  sections.push(listSection("Skills", c.skills));
  sections.push(listSection("Performance tasks", c.performanceTasks));
  if (c.assessment) {
    sections.push(listSection("Formative assessment", c.assessment.formative));
    sections.push(listSection("Summative assessment", c.assessment.summative));
  }
  if (c.relatedSkills?.trim()) {
    sections.push(`**Related 21st-century skills:** ${c.relatedSkills.trim()}`);
  }

  return sections.filter((s) => s.length > 0).join("\n\n");
}
