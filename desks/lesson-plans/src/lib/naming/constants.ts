/**
 * constants.ts — single source of truth for the lesson-plan filename
 * naming convention.
 *
 * Filenames look like `G7_Math_T1a_W1_L1` — order is
 * `Grade_Subject_Term_Week_Lesson`, underscore-separated:
 *
 *   Grade   — `G` followed by 1–2 digits         (e.g. G7, G12)
 *   Subject — a single TitleCase token of letters (e.g. Math, Kiswahili)
 *   Term    — `T` followed by one of 1a,1b,2a,2b  (e.g. T1a)
 *   Week    — `W` followed by digits              (weeks restart each term)
 *   Lesson  — `L` followed by digits              (lessons restart each week)
 *
 * Plain module (no `server-only`) so it can be imported from server queries,
 * client components, and unit tests alike.
 */

/** Term tokens accepted by the naming convention (T-prefix stripped). */
export const TERM_VALUES = ["1a", "1b", "2a", "2b"] as const;

/** The four valid term tokens, ordered chronologically across the year. */
export type Term = (typeof TERM_VALUES)[number];

/**
 * Maps each term token to its chronological ordinal (1-based). Weeks restart
 * at 1 each term, so the ordinal is what gives a single global ordering.
 */
export const TERM_ORDINAL = {
  "1a": 1,
  "1b": 2,
  "2a": 3,
  "2b": 4,
} as const satisfies Record<Term, number>;

/** Reverse of {@link TERM_ORDINAL}: ordinal → term token. */
export const ORDINAL_TERM = {
  1: "1a",
  2: "1b",
  3: "2a",
  4: "2b",
} as const satisfies Record<number, Term>;

/** Field separator between filename segments. */
export const SEPARATOR = "_";

/**
 * Zero-pad width for sequence numbers when a stable, sortable string form is
 * needed downstream. Filenames themselves are unpadded (e.g. `W1`, not `W01`).
 */
export const SEQUENCE_PAD = 2;

/**
 * Single source of truth bundle for the naming convention. Importers should
 * read from here rather than re-deriving the regex or maps.
 */
export const NAMING = {
  /**
   * Anchored, named-group regex for a full filename (extension already
   * stripped). Groups: `grade`, `subject`, `term`, `week`, `lesson`.
   *
   * Built via `new RegExp` (not a literal) so the named groups compile under
   * this project's `target: ES2017` — named capture is fully supported at
   * runtime on Node/V8, only the literal syntax is gated by the TS target.
   * Source pattern: `^G(?<grade>\d{1,2})_(?<subject>[A-Za-z]+)_T(?<term>[12][ab])_W(?<week>\d+)_L(?<lesson>\d+)$`
   */
  regex: new RegExp(
    "^G(?<grade>\\d{1,2})_(?<subject>[A-Za-z]+)_T(?<term>[12][ab])_W(?<week>\\d+)_L(?<lesson>\\d+)$",
  ),
  termOrdinal: TERM_ORDINAL,
  ordinalTerm: ORDINAL_TERM,
  separator: SEPARATOR,
  sequencePad: SEQUENCE_PAD,
} as const;
