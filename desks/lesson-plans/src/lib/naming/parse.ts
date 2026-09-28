/**
 * parse.ts — parse a lesson-plan filename into its structured parts.
 *
 * Pure module (no `server-only`, no I/O). Returns a discriminated result union
 * so callers handle the malformed case explicitly rather than catching throws.
 *
 * @see ./constants.ts for the convention itself.
 * @see ./format.ts for the inverse (`buildFilename`).
 */
import { NAMING, type Term, TERM_ORDINAL } from "./constants";

/** Structured fields extracted from a valid filename. */
export interface ParsedFilename {
  /** Grade token as written, e.g. `G7`. */
  grade: string;
  /** Numeric grade, e.g. `7`. */
  gradeNum: number;
  /** Subject token (TitleCase as written), e.g. `Math`. */
  subject: string;
  /** Term token, one of `1a`,`1b`,`2a`,`2b`. */
  term: Term;
  /** Chronological term ordinal (1–4) from {@link TERM_ORDINAL}. */
  termOrdinal: number;
  /** Week number within the term (1-based). */
  week: number;
  /** Lesson number within the week (1-based). */
  lesson: number;
  /** Kebab-case, lowercased form of the filename, e.g. `g7-math-t1a-w1-l1`. */
  slug: string;
}

/** Successful parse / failure with a human-readable reason. */
export type ParseResult =
  | { ok: true; value: ParsedFilename }
  | { ok: false; reason: string };

/** Remove a single trailing file extension (e.g. `.pdf`) if present. */
function stripExtension(name: string): string {
  return name.replace(/\.[^./\\]+$/, "");
}

/**
 * Parse a lesson-plan filename (with or without an extension) into its parts.
 *
 * @example
 *   parse("G7_Math_T1a_W1_L1.pdf")
 *   // → { ok: true, value: { grade: "G7", gradeNum: 7, subject: "Math",
 *   //      term: "1a", termOrdinal: 1, week: 1, lesson: 1,
 *   //      slug: "g7-math-t1a-w1-l1" } }
 */
export function parse(filename: string): ParseResult {
  if (typeof filename !== "string" || filename.trim() === "") {
    return { ok: false, reason: "Filename is empty" };
  }

  const base = stripExtension(filename.trim());
  const match = NAMING.regex.exec(base);
  if (!match?.groups) {
    return {
      ok: false,
      reason: `"${base}" does not match Grade_Subject_Term_Week_Lesson (e.g. G7_Math_T1a_W1_L1)`,
    };
  }

  const { grade, subject, term, week, lesson } = match.groups as {
    grade: string;
    subject: string;
    term: string;
    week: string;
    lesson: string;
  };

  // The regex guarantees `term` is one of the four valid tokens.
  const termKey = term as Term;
  const slug = base.toLowerCase().split(NAMING.separator).join("-");

  return {
    ok: true,
    value: {
      grade: `G${grade}`,
      gradeNum: Number(grade),
      subject,
      term: termKey,
      termOrdinal: TERM_ORDINAL[termKey],
      week: Number(week),
      lesson: Number(lesson),
      slug,
    },
  };
}
