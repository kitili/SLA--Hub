/**
 * format.ts — build a canonical lesson-plan filename from structured parts.
 *
 * Pure module (no `server-only`, no I/O). The inverse of `parse`: the output
 * of {@link buildFilename} round-trips back through `parse` unchanged.
 *
 * @see ./constants.ts for the convention itself.
 * @see ./parse.ts for the inverse.
 */
import { NAMING } from "./constants";

/** Fields needed to assemble a filename. `grade` accepts `7` or `"G7"`. */
export interface FilenameParts {
  grade: string | number;
  subject: string;
  term: string;
  week: number;
  lesson: number;
}

/** Coerce a grade given as `7`, `"7"`, or `"G7"` into its numeric value. */
function gradeNumber(grade: string | number): number {
  if (typeof grade === "number") return grade;
  return Number(grade.trim().replace(/^[Gg]/, ""));
}

/**
 * Assemble a canonical filename (no extension) from its parts.
 *
 * @example
 *   buildFilename({ grade: 7, subject: "Math", term: "1a", week: 1, lesson: 1 })
 *   // → "G7_Math_T1a_W1_L1"
 */
export function buildFilename(input: FilenameParts): string {
  const grade = gradeNumber(input.grade);
  const term = input.term.replace(/^[Tt]/, "");
  const sep = NAMING.separator;
  return [
    `G${grade}`,
    input.subject,
    `T${term}`,
    `W${input.week}`,
    `L${input.lesson}`,
  ].join(sep);
}
