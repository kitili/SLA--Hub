/**
 * Structured 3-minute policy briefing script — used by the member player and
 * stored on `policy_briefings.script_en` / `script_sw`.
 *
 * Pure module (no DB / env) so unit tests and the generate pipeline share one
 * shape and one extractive fallback.
 */
import { z } from "zod";

export interface PolicyBriefingChapter {
  heading: string;
  body: string;
}

export interface PolicyBriefingScript {
  title: string;
  intro: string;
  chapters: PolicyBriefingChapter[];
  close: string;
  nextStep: string;
}

export const policyBriefingScriptSchema = z.object({
  title: z.string().trim().min(1).max(200),
  intro: z.string().trim().min(1).max(2000),
  chapters: z
    .array(
      z.object({
        heading: z.string().trim().min(1).max(120),
        body: z.string().trim().min(1).max(2000),
      }),
    )
    .min(4)
    .max(14),
  close: z.string().trim().min(1).max(1000),
  nextStep: z.string().trim().min(1).max(400),
});

export const POLICIES_SECTION_ID = "policies";

export function isPolicySection(sectionId: string): boolean {
  return sectionId === POLICIES_SECTION_ID;
}

/** PDF / DOCX / plain text can be turned into a briefing. */
export function isExtractablePolicyFile(
  filename: string,
  contentType?: string | null,
): boolean {
  const name = filename.toLowerCase();
  const type = (contentType ?? "").toLowerCase();
  return (
    name.endsWith(".pdf") ||
    name.endsWith(".docx") ||
    name.endsWith(".txt") ||
    type.includes("pdf") ||
    type.includes("wordprocessingml") ||
    type === "text/plain" ||
    type === "application/msword"
  );
}

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function headingFromBody(body: string, index: number): string {
  const words = body.trim().split(/\s+/).slice(0, 6).join(" ");
  if (words.length >= 8 && words.length <= 48) {
    const cleaned = words.replace(/[.,;:]+$/, "");
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return `Key point ${index + 1}`;
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\f/g, "\n")
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= 40 && countWords(s) >= 8);
}

/**
 * Build a briefing from raw policy text when no LLM key is configured (or the
 * model call fails). Faithful extract: real sentences from the document, not
 * invented rules.
 */
export function buildExtractiveBriefing(
  title: string,
  rawText: string,
): PolicyBriefingScript {
  const policyTitle = title.trim() || "this policy";
  const sentences = splitSentences(rawText);
  const targetChapters = 10;
  const chapters: PolicyBriefingChapter[] = [];

  if (sentences.length === 0) {
    throw new Error("NO_TEXT");
  }

  const perChapter = Math.max(1, Math.ceil(sentences.length / targetChapters));
  for (let i = 0; i < sentences.length && chapters.length < 12; i += perChapter) {
    const chunk = sentences.slice(i, i + perChapter).join(" ");
    const words = chunk.split(/\s+/);
    const body = words.length > 70 ? words.slice(0, 70).join(" ") : chunk;
    chapters.push({
      heading: headingFromBody(body, chapters.length),
      body,
    });
  }

  while (chapters.length > 12) chapters.pop();
  while (chapters.length < 4 && sentences[chapters.length]) {
    const body = sentences[chapters.length]!;
    chapters.push({
      heading: headingFromBody(body, chapters.length),
      body,
    });
  }

  if (chapters.length < 4) {
    throw new Error("NO_TEXT");
  }

  return {
    title: policyTitle,
    intro:
      `This is your three-minute briefing on ${policyTitle}. ` +
      "The full document remains the official policy — this briefing highlights " +
      "the major points you must know from day one.",
    chapters,
    close:
      `Open the full ${policyTitle} next, confirm anything that applies to your role, ` +
      "then digitally sign this policy. The written policy always wins over this briefing.",
    nextStep: `Open the full ${policyTitle}, then digitally sign this policy.`,
  };
}

export function parseBriefingScript(
  value: unknown,
): PolicyBriefingScript | null {
  const parsed = policyBriefingScriptSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
