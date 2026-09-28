/**
 * Scheme-of-Work parsing (AI Studio v2) — PURE: no DB, no network, no `ai`.
 *
 * Turns an uploaded scheme (docx or CSV) into a {@link ParsedSow}: the scheme
 * header (metadata + the structured UbD {@link SchemeHeaderContext}) plus one
 * {@link ParsedSowRow} per lesson, with cells mapped to the 11 Silverleaf SOW
 * columns by tolerant header-keyword matching (column names drift across
 * templates, so we match on regex, not exact strings).
 *
 * The revised "Understanding by Design" docx is a MULTI-TABLE document:
 *   table[0]      — metadata grid (Grade / Subject / Term / Weeks / Competence…)
 *   table[1]      — DESIRED RESULTS (transfer goal, EUs, EQs, knowledge, skills)
 *   table[2..3]   — ACCEPTABLE EVIDENCE (performance tasks, assessment plan)
 *   table[4..N]   — one table per week; row 0 is "Week N: title", row 1 the
 *                   column headers, rows 2+ the lessons.
 * Real files are messy (duplicate week sets, empty `Week:` templates), so week
 * tables are de-duplicated: empties dropped, and the richest variant kept per
 * week number.
 *
 * Only `parseSowDocx` touches a third-party lib (`mammoth`, to get HTML); table
 * extraction and all field mapping are dependency-free string/regex work exposed
 * via {@link parseSowHtml} so the logic is unit-testable without any I/O.
 *
 * @see ../db/schema/sowLessons.ts — the columns the rows map onto.
 * @see ./types.ts — the {@link SchemeHeaderContext} shape.
 */
import mammoth from "mammoth";
import Papa from "papaparse";

import {
  emptySchemeHeaderContext,
  type SchemeHeaderContext,
} from "./types";

/** One parsed scheme row, mapped to the 11 SOW columns (all optional). */
export interface ParsedSowRow {
  week?: number;
  lessonNumber?: string;
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
  /** Every detected cell keyed by its header label, for provenance. */
  rawCells: Record<string, string>;
}

/** Scheme-level metadata parsed from the docx metadata grid. */
export interface ParsedSowMeta {
  title?: string;
  grade?: string;
  subject?: string;
  term?: string;
  year?: string;
  mainCompetence?: string;
  weeksCount?: number;
  lessonsPerWeek?: number;
  lessonDurationMins?: number;
  totalLessons?: string;
}

/** A parsed scheme: metadata + structured UbD header + the lesson rows. */
export interface ParsedSow {
  scheme: ParsedSowMeta;
  headerContext: SchemeHeaderContext;
  rows: ParsedSowRow[];
  /** Provenance stats for the upload preview. */
  stats: { weekTablesKept: number; weekTablesDropped: number };
}

/** The mappable target fields (everything on a row except week/raw). */
type MappableField = Exclude<
  keyof ParsedSowRow,
  "week" | "lessonNumber" | "rawCells"
>;

/**
 * Ordered header → field rules. Order matters: more specific patterns first so,
 * e.g., "learning activities" / "sample lesson activities" is not stolen by the
 * generic main-activity rule, and "Lesson Objective" is not stolen by the bare
 * "lesson" rule.
 */
const FIELD_RULES: ReadonlyArray<{
  field: MappableField | "lessonNumber" | "week";
  re: RegExp;
}> = [
  { field: "specificCompetence", re: /specific competence/i },
  { field: "lessonObjective", re: /objective/i },
  { field: "knowledgeAndSkills", re: /knowledge|skills?/i },
  { field: "assessmentEvidence", re: /assessment|evidence/i },
  { field: "learningActivities", re: /learning activit|sample.*activit/i },
  { field: "mainActivity", re: /main activit/i },
  { field: "misconceptions", re: /misconception/i },
  { field: "differentiationSupport", re: /differen/i },
  { field: "resources", re: /resource/i },
  { field: "reflection", re: /reflection|remark/i },
  { field: "lessonNumber", re: /lesson/i },
  { field: "week", re: /week|^wk\b/i },
];

/** Collapse whitespace, decode the few entities mammoth/CSV emit, trim. */
function cleanCell(raw: string): string {
  return raw
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Map a header label to a SOW field. Returns the first matching rule's field,
 * or null if nothing matches (the cell still survives in `rawCells`).
 */
function fieldForHeader(
  header: string,
): (typeof FIELD_RULES)[number]["field"] | null {
  for (const rule of FIELD_RULES) {
    if (rule.re.test(header)) return rule.field;
  }
  return null;
}

/** A header row is one whose cells contain a recognisable SOW column label. */
function looksLikeHeaderRow(cells: string[]): boolean {
  return cells.some((c) => /specific competence|objective|activit/i.test(c));
}

/** Parse "Week 3", "wk 3", "3" → 3; non-numeric → undefined. */
function parseWeek(value: string): number | undefined {
  const m = value.match(/(\d+)/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

/** First run of digits in a string → int, else undefined. */
function firstInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const m = value.match(/\d+/);
  return m ? parseInt(m[0], 10) : undefined;
}

/**
 * Build a {@link ParsedSowRow} from a header→cell pairing. Shared by the docx
 * and CSV paths so both map identically.
 */
function rowFromPairs(pairs: Array<{ header: string; value: string }>): ParsedSowRow {
  const row: ParsedSowRow = { rawCells: {} };

  for (const { header, value } of pairs) {
    const cleanHeader = cleanCell(header);
    const cleanValue = cleanCell(value);
    if (!cleanHeader && !cleanValue) continue;
    if (cleanHeader) row.rawCells[cleanHeader] = cleanValue;

    const field = fieldForHeader(cleanHeader);
    if (!field || !cleanValue) continue;

    if (field === "week") {
      if (row.week === undefined) row.week = parseWeek(cleanValue);
    } else if (field === "lessonNumber") {
      if (row.lessonNumber === undefined) row.lessonNumber = cleanValue;
    } else if (row[field] === undefined) {
      row[field] = cleanValue;
    }
  }

  return row;
}

/** Count the mapped (non-raw) fields a row carries — used to rank duplicates. */
function mappedFieldCount(row: ParsedSowRow): number {
  const { rawCells, week, ...mapped } = row;
  void rawCells;
  void week;
  return Object.values(mapped).filter((v) => v !== undefined && v !== "").length;
}

/** True when a row carries no mapped data (only empties) — skip it. */
function isEmptyRow(row: ParsedSowRow): boolean {
  const { rawCells, ...mapped } = row;
  const hasMapped = Object.values(mapped).some((v) => v !== undefined);
  if (hasMapped) return false;
  // Or any non-empty raw cell value.
  return !Object.values(rawCells).some((v) => v.length > 0);
}

/* ── docx table extraction ─────────────────────────────────────────────── */

/**
 * Extract EVERY `<table>` in an HTML fragment as a list of 2-D row×cell arrays.
 * Dependency-free: a forgiving regex/string scan that strips tags inside each
 * cell. Good enough for mammoth's flat table HTML.
 */
function extractAllTables(html: string): string[][][] {
  const tables: string[][][] = [];
  const tableRe = /<table[\s\S]*?<\/table>/gi;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRe.exec(html)) !== null) {
    const table = tableMatch[0];
    const rows: string[][] = [];
    const rowRe = /<tr[\s\S]*?<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRe.exec(table)) !== null) {
      const rowHtml = rowMatch[0];
      const cells: string[] = [];
      const cellRe = /<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRe.exec(rowHtml)) !== null) {
        const inner = cellMatch[2] ?? "";
        const text = inner
          .replace(/<\/(p|div|li|br)\s*>/gi, " ")
          .replace(/<br\s*\/?>/gi, " ")
          .replace(/<[^>]+>/g, "");
        cells.push(text);
      }
      if (cells.length > 0) rows.push(cells.map(cleanCell));
    }
    if (rows.length > 0) tables.push(rows);
  }
  return tables;
}

/* ── table classification ──────────────────────────────────────────────── */

type TableKind = "meta" | "desired" | "evidence" | "assessment" | "week" | "other";

function classifyTable(table: string[][]): TableKind {
  const row0first = table[0]?.[0] ?? "";
  if (/^\s*week\b/i.test(row0first)) return "week";

  const joined = table.flat().join("  ").toLowerCase();
  if (/desired results/.test(joined) || /enduring understanding/.test(joined)) {
    return "desired";
  }
  // Assessment BEFORE evidence: a table carrying BOTH a formative and a
  // summative section is unambiguously the assessment plan, even when its prose
  // mentions a "performance task" in passing (which would otherwise let the
  // evidence rule steal it).
  if (/formative assessment/.test(joined) && /summative/.test(joined)) {
    return "assessment";
  }
  if (/acceptable evidence/.test(joined) || /performance task/.test(joined)) {
    return "evidence";
  }
  if (/\bgrade\b/.test(joined) && /main competence|subject|\bterm\b/.test(joined)) {
    return "meta";
  }
  return "other";
}

/* ── metadata block ────────────────────────────────────────────────────── */

/** Metadata label → key. Order: more specific first. */
const META_RULES: ReadonlyArray<{ key: keyof ParsedSowMeta | "specificCompetences" | "relatedSkills"; re: RegExp }> = [
  { key: "weeksCount", re: /number of weeks/i },
  { key: "mainCompetence", re: /main competence/i },
  { key: "lessonsPerWeek", re: /lessons?\s*\/?\s*periods?\s*per week|lessons? per week|periods? per week/i },
  { key: "lessonDurationMins", re: /duration/i },
  { key: "totalLessons", re: /total lessons/i },
  { key: "specificCompetences", re: /specific competence/i },
  { key: "relatedSkills", re: /21st century|21st-century/i },
  { key: "subject", re: /subject/i },
  { key: "term", re: /\bterm\b/i },
  { key: "year", re: /\byear\b/i },
  { key: "grade", re: /\bgrade\b/i },
];

/** Parse the metadata grid (label/value pairs across columns) into meta + UbD bits. */
function parseMetaTable(
  table: string[][],
): { meta: ParsedSowMeta; specificCompetences?: string; relatedSkills?: string } {
  const meta: ParsedSowMeta = {};
  let specificCompetences: string | undefined;
  let relatedSkills: string | undefined;

  for (const row of table) {
    for (let i = 0; i + 1 < row.length; i += 2) {
      const label = row[i] ?? "";
      const value = row[i + 1] ?? "";
      if (!label || !value) continue;
      const rule = META_RULES.find((r) => r.re.test(label));
      if (!rule) continue;
      switch (rule.key) {
        case "weeksCount":
          meta.weeksCount ??= firstInt(value);
          break;
        case "lessonsPerWeek":
          meta.lessonsPerWeek ??= firstInt(value);
          break;
        case "lessonDurationMins":
          meta.lessonDurationMins ??= firstInt(value);
          break;
        case "mainCompetence":
          meta.mainCompetence ??= value;
          break;
        case "totalLessons":
          meta.totalLessons ??= value;
          break;
        case "subject":
          meta.subject ??= value;
          break;
        case "term":
          meta.term ??= value.replace(/^term\s+/i, "").trim();
          break;
        case "year":
          meta.year ??= value;
          break;
        case "grade": {
          if (meta.grade === undefined) {
            const n = firstInt(value);
            meta.grade = n != null ? `Grade ${n}` : value;
          }
          break;
        }
        case "specificCompetences":
          specificCompetences ??= value;
          break;
        case "relatedSkills":
          relatedSkills ??= value;
          break;
      }
    }
  }

  return { meta, specificCompetences, relatedSkills };
}

/* ── desired results ───────────────────────────────────────────────────── */

/** Split a blob into items each starting at a label like K1, EU2, S7a, EQ3. */
function splitByLabel(text: string, labelRe: RegExp): string[] {
  const global = new RegExp(labelRe, "g");
  const markers = [...text.matchAll(global)];
  if (markers.length === 0) {
    const t = text.trim();
    return t ? [t] : [];
  }
  const items: string[] = [];
  for (let i = 0; i < markers.length; i += 1) {
    const start = markers[i]!.index ?? 0;
    const end = i + 1 < markers.length ? (markers[i + 1]!.index ?? text.length) : text.length;
    const item = text.slice(start, end).trim();
    if (item) items.push(item);
  }
  return items;
}

const DESIRED_COL_RULES: ReadonlyArray<{
  key: "transferGoal" | "enduringUnderstandings" | "essentialQuestions" | "knowledge" | "skills";
  re: RegExp;
}> = [
  { key: "transferGoal", re: /transfer goal/i },
  { key: "enduringUnderstandings", re: /enduring understanding/i },
  { key: "essentialQuestions", re: /essential question/i },
  { key: "knowledge", re: /knowledge/i },
  { key: "skills", re: /\bskills?\b/i },
];

/** Parse the DESIRED RESULTS table into the UbD header fields. */
function parseDesiredResults(table: string[][], ctx: SchemeHeaderContext): void {
  // Find the column-header row (the one naming the five columns).
  const headerIdx = table.findIndex((row) =>
    row.some((c) => /transfer goal|enduring understanding|essential question/i.test(c)),
  );
  if (headerIdx < 0) return;
  const headers = table[headerIdx]!;

  // Map each header column index → target key.
  const colKey: Array<(typeof DESIRED_COL_RULES)[number]["key"] | null> = headers.map((h) => {
    const rule = DESIRED_COL_RULES.find((r) => r.re.test(h));
    return rule ? rule.key : null;
  });

  // Concatenate every data row below the header, per column.
  const colText: Record<string, string> = {};
  for (let r = headerIdx + 1; r < table.length; r += 1) {
    const row = table[r]!;
    row.forEach((cell, c) => {
      const key = colKey[c];
      if (!key || !cell) return;
      colText[key] = colText[key] ? `${colText[key]} ${cell}` : cell;
    });
  }

  if (colText.transferGoal) ctx.transferGoal = colText.transferGoal.trim();
  if (colText.enduringUnderstandings) {
    ctx.enduringUnderstandings = splitByLabel(
      colText.enduringUnderstandings,
      /\b(?:EU|U)\d+\s*[.\-)]/,
    );
  }
  if (colText.essentialQuestions) {
    ctx.essentialQuestions = splitByLabel(colText.essentialQuestions, /\bEQ\d+\s*[.\-)]/);
  }
  if (colText.knowledge) {
    ctx.knowledge = splitByLabel(colText.knowledge, /\bK\d+\s*[.\-)]/);
  }
  if (colText.skills) {
    ctx.skills = splitByLabel(colText.skills, /\bS\d+[a-z]?\s*[.\-)]/);
  }
}

/* ── acceptable evidence ───────────────────────────────────────────────── */

/** Parse the ACCEPTABLE EVIDENCE (performance tasks) table. */
function parseEvidence(table: string[][], ctx: SchemeHeaderContext): void {
  // Header row names the task columns (Task | Details | Success Criteria | …).
  const headerIdx = table.findIndex((row) =>
    row.some((c) => /success criteria|rubric|details/i.test(c)),
  );
  const start = headerIdx >= 0 ? headerIdx + 1 : 1; // skip section-title row otherwise
  const tasks: string[] = [];
  for (let r = start; r < table.length; r += 1) {
    const row = table[r]!;
    const parts = row.map((c) => c.trim()).filter(Boolean);
    if (parts.length === 0) continue;
    // Drop a repeated header row.
    if (parts.some((p) => /success criteria/i.test(p))) continue;
    tasks.push(parts.join(" — "));
  }
  if (tasks.length > 0) ctx.performanceTasks.push(...tasks);
}

/** Parse the formative/summative assessment-plan table. */
function parseAssessmentPlan(table: string[][], ctx: SchemeHeaderContext): void {
  const formative: string[] = [];
  const summative: string[] = [];

  // Find the sub-header row carrying two "Type" columns to locate the split.
  let mid = -1;
  const subHeaderIdx = table.findIndex((row) => {
    const typeCols = row
      .map((c, i) => (/^type$/i.test(c.trim()) ? i : -1))
      .filter((i) => i >= 0);
    if (typeCols.length >= 2) {
      mid = typeCols[1]!;
      return true;
    }
    return false;
  });

  const start = subHeaderIdx >= 0 ? subHeaderIdx + 1 : 2;
  for (let r = start; r < table.length; r += 1) {
    const row = table[r]!;
    const split = mid > 0 ? mid : Math.ceil(row.length / 2);
    const left = row.slice(0, split).map((c) => c.trim()).filter(Boolean).join(" — ");
    const right = row.slice(split).map((c) => c.trim()).filter(Boolean).join(" — ");
    if (left) formative.push(left);
    if (right) summative.push(right);
  }

  if (formative.length > 0 || summative.length > 0) {
    const existing = ctx.assessment ?? { formative: [], summative: [] };
    existing.formative.push(...formative);
    existing.summative.push(...summative);
    ctx.assessment = existing;
  }
}

/* ── week tables ───────────────────────────────────────────────────────── */

/** Parse one week table → { week, rows }. */
function parseWeekTable(table: string[][]): { week?: number; rows: ParsedSowRow[] } {
  const titleRow = table[0] ?? [];
  const week = parseWeek(titleRow.join(" "));

  // The column-header row is the first header-looking row after the title.
  let headerIdx = table.findIndex((cells, i) => i > 0 && looksLikeHeaderRow(cells));
  if (headerIdx < 0) headerIdx = looksLikeHeaderRow(titleRow) ? 0 : 1;
  const headers = (table[headerIdx] ?? []).map(cleanCell);
  /** Signature of the header row, used to spot verbatim repeats in the body. */
  const headerKey = headers.join("|").toLowerCase();

  const rows: ParsedSowRow[] = [];
  for (let i = headerIdx + 1; i < table.length; i += 1) {
    const cells = table[i];
    if (!cells) continue;
    // A header repeated inside the body is a verbatim copy of the header row.
    // Keyword-matching here instead (as `looksLikeHeaderRow` does) silently
    // drops real lessons whose prose mentions "objective" or "activity" — e.g.
    // a Resources cell reading "…with the habitat activity on page 3".
    if (cells.map(cleanCell).join("|").toLowerCase() === headerKey) continue;
    const pairs = cells.map((value, idx) => ({
      header: headers[idx] ?? `col_${idx + 1}`,
      value,
    }));
    const row = rowFromPairs(pairs);
    if (row.week === undefined && week !== undefined) row.week = week;
    if (!isEmptyRow(row)) rows.push(row);
  }
  return { week, rows };
}

/**
 * De-duplicate the parsed week tables: drop empties, and when a week number
 * appears more than once keep the variant with the most populated cells.
 *
 * Real revised-template docs always title their weeks ("Week N: …"); leftover
 * *unnumbered* "Week:" draft/template tables therefore duplicate numbered weeks
 * and are dropped whenever any numbered week is present. They are kept (in
 * document order) ONLY as a fallback when no week could be numbered at all.
 * Returns the ordered rows and kept/dropped stats.
 */
function dedupeWeekTables(
  parsed: Array<{ week?: number; rows: ParsedSowRow[] }>,
): { rows: ParsedSowRow[]; kept: number; dropped: number } {
  const nonEmpty = parsed.filter((p) => p.rows.length > 0);
  let dropped = parsed.length - nonEmpty.length;

  // Best variant per numbered week.
  const byWeek = new Map<number, { rows: ParsedSowRow[]; score: number }>();
  const unnumbered: Array<{ rows: ParsedSowRow[] }> = [];

  for (const p of nonEmpty) {
    if (p.week === undefined) {
      unnumbered.push(p);
      continue;
    }
    const score = p.rows.reduce((s, r) => s + mappedFieldCount(r), 0);
    const cur = byWeek.get(p.week);
    if (!cur) {
      byWeek.set(p.week, { rows: p.rows, score });
    } else {
      if (score > cur.score) byWeek.set(p.week, { rows: p.rows, score });
      dropped += 1; // a duplicate of an already-seen week
    }
  }

  const numbered = [...byWeek.keys()].sort((a, b) => a - b);
  const rows: ParsedSowRow[] = [];
  for (const w of numbered) rows.push(...byWeek.get(w)!.rows);

  // Unnumbered tables are drafts when numbered weeks exist → drop them.
  if (numbered.length === 0) {
    for (const u of unnumbered) rows.push(...u.rows);
    return { rows, kept: unnumbered.length, dropped };
  }
  return { rows, kept: numbered.length, dropped: dropped + unnumbered.length };
}

/* ── public: HTML / docx ───────────────────────────────────────────────── */

/**
 * Parse a revised-template SOW from an HTML fragment (mammoth output). Exposed
 * for unit tests; {@link parseSowDocx} is the docx wrapper.
 */
export function parseSowHtml(html: string): ParsedSow {
  const tables = extractAllTables(html);
  const ctx = emptySchemeHeaderContext();
  let meta: ParsedSowMeta = {};
  const weekTables: Array<{ week?: number; rows: ParsedSowRow[] }> = [];

  for (const table of tables) {
    switch (classifyTable(table)) {
      case "meta": {
        const parsed = parseMetaTable(table);
        meta = { ...parsed.meta, ...meta };
        if (parsed.specificCompetences) ctx.specificCompetences = parsed.specificCompetences;
        if (parsed.relatedSkills) ctx.relatedSkills = parsed.relatedSkills;
        break;
      }
      case "desired":
        parseDesiredResults(table, ctx);
        break;
      case "evidence":
        parseEvidence(table, ctx);
        break;
      case "assessment":
        parseAssessmentPlan(table, ctx);
        break;
      case "week":
        weekTables.push(parseWeekTable(table));
        break;
      case "other":
        break;
    }
  }

  const { rows, kept, dropped } = dedupeWeekTables(weekTables);

  return {
    scheme: meta,
    headerContext: ctx,
    rows,
    stats: { weekTablesKept: kept, weekTablesDropped: dropped },
  };
}

/**
 * Parse a `.docx` scheme into a {@link ParsedSow}. Converts to HTML with
 * mammoth, then delegates to {@link parseSowHtml}.
 *
 * @param buf The raw docx bytes.
 */
export async function parseSowDocx(buf: Buffer): Promise<ParsedSow> {
  const { value: html } = await mammoth.convertToHtml({ buffer: buf });
  return parseSowHtml(html);
}

/* ── CSV ──────────────────────────────────────────────────────────────── */

/**
 * Parse a CSV scheme into a {@link ParsedSow}. Uses papaparse with `header:true`
 * (first row → keys), then maps each record via the same keyword rules as the
 * docx path. A CSV carries only lesson rows — no UbD header — so `scheme` and
 * `headerContext` come back empty.
 *
 * @param text The raw CSV text.
 */
export function parseSowCsv(text: string): ParsedSow {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  const rows: ParsedSowRow[] = [];
  for (const record of parsed.data) {
    if (!record || typeof record !== "object") continue;
    const pairs = Object.entries(record).map(([header, value]) => ({
      header,
      value: value == null ? "" : String(value),
    }));
    const row = rowFromPairs(pairs);
    if (!isEmptyRow(row)) rows.push(row);
  }

  return {
    scheme: {},
    headerContext: emptySchemeHeaderContext(),
    rows,
    stats: { weekTablesKept: 0, weekTablesDropped: 0 },
  };
}
