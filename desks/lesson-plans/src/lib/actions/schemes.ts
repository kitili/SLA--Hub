"use server";

/**
 * Admin server actions — Schemes of Work (AI Studio v2).
 *
 * CRUD + upload-preview for `schemes_of_work` and their `sow_lessons` rows.
 * All actions are admin-only. Mutations revalidate the schemes admin page via
 * its "/[locale]/..." route pattern (locale-less literals match nothing — see
 * feedback.ts).
 *
 * gradeNum:    parseInt(grade.replace(/\D/g, ''))       e.g. "Grade 7" → 7
 * termOrdinal: { "1a":1, "1b":2, "2a":3, "2b":4 }
 */
import { asc, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { actionFailure, type ActionResult } from "@/lib/contracts";
import { db } from "@/lib/db";
import { schemesOfWork, sowLessons } from "@/lib/db/schema";
import {
  parseSowDocx,
  parseSowCsv,
  type ParsedSow,
  type ParsedSowRow,
} from "@/lib/sow/parse";
import {
  isEmptyHeaderContext,
  type SchemeHeaderContext,
} from "@/lib/sow/types";

// ── helpers ──────────────────────────────────────────────────────────────────

const TERM_ORDINAL_MAP: Record<string, number> = {
  "1a": 1,
  "1b": 2,
  "2a": 3,
  "2b": 4,
};

function deriveGradeNum(grade: string): number {
  return parseInt(grade.replace(/\D/g, ""), 10) || 0;
}

function deriveTermOrdinal(term: string): number {
  return TERM_ORDINAL_MAP[term.toLowerCase()] ?? 0;
}

/** The scheme header/meta fields derived for previewing and persisting. */
interface DerivedSchemeFields {
  title: string;
  grade: string;
  gradeNum: number;
  subject: string;
  term: string;
  termOrdinal: number;
  year: string | undefined;
  mainCompetence: string | undefined;
  weeksCount: number | undefined;
  lessonsPerWeek: number | undefined;
  lessonDurationMins: number | undefined;
  totalLessons: string | undefined;
}

/** Best-effort scheme meta derived from ParsedSow (filename backs up title only). */
function deriveSchemeFields(
  parsed: ParsedSow,
  filename?: string,
): DerivedSchemeFields {
  const s = parsed.scheme;

  // Deliberately NO filename fallback for grade/subject/term: a filename is
  // not a grade, and feeding one through deriveGradeNum would turn e.g.
  // "SOW-2024-Arithmetic.docx" into gradeNum 2024 (wrong sorting, wrong batch
  // naming). Blank fields are reviewed/overridden by the admin in the upload
  // preview before anything is persisted. Only `title` falls back to filename.
  const grade = s.grade ?? "";
  const subject = s.subject ?? "";
  const term = s.term ?? "";
  const year = s.year;

  const gradeNum = deriveGradeNum(grade);
  const termOrdinal = deriveTermOrdinal(term);

  // Build a sensible title from available parts.
  const parts = [grade, subject, term ? `Term ${term.toUpperCase()}` : ""]
    .filter(Boolean);
  const title = s.title ?? (parts.length > 0 ? parts.join(" — ") : (filename ?? "Untitled scheme"));

  return {
    title,
    grade,
    gradeNum,
    subject,
    term,
    termOrdinal,
    year,
    mainCompetence: s.mainCompetence,
    weeksCount: s.weeksCount,
    lessonsPerWeek: s.lessonsPerWeek,
    lessonDurationMins: s.lessonDurationMins,
    totalLessons: s.totalLessons,
  };
}

// Input types ─────────────────────────────────────────────────────────────────

export interface SowUploadInput {
  kind: "docx" | "csv";
  /** Base-64 encoded file bytes (used for docx). */
  dataBase64?: string;
  /** Raw CSV text (used for csv). */
  text?: string;
  /** Original filename for fallback meta derivation. */
  filename?: string;
}

export interface CreateSchemeInput extends SowUploadInput {
  /** Optional caller-supplied overrides for scheme metadata. */
  title?: string;
  grade?: string;
  subject?: string;
  term?: string;
  year?: string;
}

// ── listSchemes ───────────────────────────────────────────────────────────────

/** List all schemes of work with a lesson-row count. Admin-only. */
export async function listSchemes(): Promise<
  ActionResult & {
    schemes?: Array<typeof schemesOfWork.$inferSelect & { rowCount: number }>;
  }
> {
  await requireAdmin();

  try {
    const rows = await db
      .select({
        scheme: schemesOfWork,
        rowCount: count(sowLessons.id),
      })
      .from(schemesOfWork)
      .leftJoin(sowLessons, eq(sowLessons.schemeId, schemesOfWork.id))
      .groupBy(schemesOfWork.id)
      .orderBy(
        asc(schemesOfWork.gradeNum),
        asc(schemesOfWork.subject),
        asc(schemesOfWork.termOrdinal),
      );

    const schemes = rows.map((r) => ({
      ...r.scheme,
      rowCount: Number(r.rowCount),
    }));

    return { ok: true, schemes };
  } catch (err) {
    return actionFailure("failed", { cause: err });
  }
}

// ── getScheme ─────────────────────────────────────────────────────────────────

/** Fetch one scheme + its sow_lessons rows ordered by orderIndex. Admin-only. */
export async function getScheme(schemeId: string): Promise<
  ActionResult & {
    scheme?: typeof schemesOfWork.$inferSelect;
    lessons?: Array<typeof sowLessons.$inferSelect>;
  }
> {
  await requireAdmin();

  if (!schemeId) return actionFailure("invalid-input");

  try {
    const schemeRows = await db
      .select()
      .from(schemesOfWork)
      .where(eq(schemesOfWork.id, schemeId))
      .limit(1);

    const scheme = schemeRows[0];
    if (!scheme) return actionFailure("not-found");

    const lessons = await db
      .select()
      .from(sowLessons)
      .where(eq(sowLessons.schemeId, schemeId))
      .orderBy(asc(sowLessons.orderIndex));

    return { ok: true, scheme, lessons };
  } catch (err) {
    return actionFailure("failed", { cause: err });
  }
}

// ── parse helper (shared by preview + create) ────────────────────────────────

async function parseUpload(
  input: SowUploadInput,
): Promise<
  { ok: true; parsed: ParsedSow } | { ok: false; error: "invalid-input" }
> {
  try {
    if (input.kind === "docx") {
      if (!input.dataBase64) return actionFailure("invalid-input");
      const buf = Buffer.from(input.dataBase64, "base64");
      const parsed = await parseSowDocx(buf);
      return { ok: true, parsed };
    } else {
      if (!input.text) return actionFailure("invalid-input");
      const parsed = parseSowCsv(input.text);
      return { ok: true, parsed };
    }
  } catch (err) {
    return actionFailure("invalid-input", { cause: err });
  }
}

// ── previewSowUpload ──────────────────────────────────────────────────────────

/**
 * Parse an uploaded SOW file and return the derived scheme header + rows
 * WITHOUT persisting anything. For pre-commit review. Admin-only.
 */
export async function previewSowUpload(input: SowUploadInput): Promise<
  ActionResult & {
    scheme?: DerivedSchemeFields;
    rows?: ParsedSowRow[];
    headerContext?: SchemeHeaderContext;
    stats?: ParsedSow["stats"];
  }
> {
  await requireAdmin();

  const result = await parseUpload(input);
  if (!result.ok) return result;

  const scheme = deriveSchemeFields(result.parsed, input.filename);
  return {
    ok: true,
    scheme,
    rows: result.parsed.rows,
    headerContext: result.parsed.headerContext,
    stats: result.parsed.stats,
  };
}

// ── createSchemeFromUpload ────────────────────────────────────────────────────

/**
 * Parse the upload, optionally override scheme meta with caller-supplied values,
 * insert `schemes_of_work` + `sow_lessons` rows, and return the new id.
 * Admin-only.
 */
export async function createSchemeFromUpload(
  input: CreateSchemeInput,
): Promise<ActionResult & { schemeId?: string; rowCount?: number }> {
  const user = await requireAdmin();

  const result = await parseUpload(input);
  if (!result.ok) return result;

  const derived = deriveSchemeFields(result.parsed, input.filename);

  // Caller overrides win over derived values.
  const title = input.title?.trim() || derived.title;
  const grade = input.grade?.trim() || derived.grade;
  const gradeNum = deriveGradeNum(grade);
  const subject = input.subject?.trim() || derived.subject;
  const term = input.term?.trim() || derived.term;
  const termOrdinal = deriveTermOrdinal(term);
  const year = input.year?.trim() || derived.year;

  // Reject degenerate scheme meta instead of persisting it: batch generation
  // derives its grade token from gradeNum (`G${gradeNum}` — 0 would silently
  // file every plan under "G0"), and a blank subject/term makes
  // `savePlanStructured` reject each plan AFTER a paid model call. The Schemes
  // page's upload grid lets the admin fill these in; the Studio panel has no
  // meta fields, so it surfaces this authored message instead.
  const missing: string[] = [];
  if (!grade || gradeNum === 0) missing.push("grade");
  if (!subject) missing.push("subject");
  if (!term) missing.push("term");
  if (missing.length > 0) {
    return actionFailure("invalid-input", {
      message: `Scheme metadata is missing or invalid: ${missing.join(", ")}. Fill in these fields (or fix the file's header), then save again.`,
    });
  }

  // Only persist a header context when it carries real curriculum content.
  const headerContext: SchemeHeaderContext | null = isEmptyHeaderContext(
    result.parsed.headerContext,
  )
    ? null
    : result.parsed.headerContext;

  try {
    const inserted = await db
      .insert(schemesOfWork)
      .values({
        title,
        grade,
        gradeNum,
        subject,
        term,
        termOrdinal,
        year,
        mainCompetence: derived.mainCompetence,
        weeksCount: derived.weeksCount,
        lessonsPerWeek: derived.lessonsPerWeek,
        lessonDurationMins: derived.lessonDurationMins,
        totalLessons: derived.totalLessons,
        headerContext,
        sourceFilename: input.filename,
        createdBy: user.id,
      })
      .returning();

    const schemeId = inserted[0]?.id;
    if (!schemeId) {
      return actionFailure("failed", { cause: "insert returned no scheme id" });
    }

    const rows = result.parsed.rows;
    if (rows.length > 0) {
      await db.insert(sowLessons).values(
        rows.map((row, idx) => ({
          schemeId,
          orderIndex: idx,
          week: row.week,
          lessonNumber: row.lessonNumber,
          specificCompetence: row.specificCompetence,
          mainActivity: row.mainActivity,
          lessonObjective: row.lessonObjective,
          knowledgeAndSkills: row.knowledgeAndSkills,
          assessmentEvidence: row.assessmentEvidence,
          learningActivities: row.learningActivities,
          misconceptions: row.misconceptions,
          differentiationSupport: row.differentiationSupport,
          resources: row.resources,
          reflection: row.reflection,
          source: "parsed" as const,
          rawCells: row.rawCells,
        })),
      );
    }

    revalidatePath("/[locale]/admin/ai-studio/schemes", "page");
    return { ok: true, schemeId, rowCount: rows.length };
  } catch (err) {
    return actionFailure("failed", { cause: err });
  }
}

// ── upsertSowLesson ───────────────────────────────────────────────────────────

export type UpsertSowLessonInput = {
  id?: string;
  schemeId: string;
  orderIndex: number;
  week?: number | null;
  lessonNumber?: string | null;
  specificCompetence?: string | null;
  mainActivity?: string | null;
  lessonObjective?: string | null;
  knowledgeAndSkills?: string | null;
  assessmentEvidence?: string | null;
  learningActivities?: string | null;
  misconceptions?: string | null;
  differentiationSupport?: string | null;
  resources?: string | null;
  reflection?: string | null;
};

/**
 * Insert or update one sow_lessons row. Manual creates use source:"manual".
 * Admin-only.
 */
export async function upsertSowLesson(
  row: UpsertSowLessonInput,
): Promise<ActionResult & { lessonId?: string }> {
  await requireAdmin();

  if (!row.schemeId) return actionFailure("invalid-input");

  try {
    const values: typeof sowLessons.$inferInsert = {
      schemeId: row.schemeId,
      orderIndex: row.orderIndex,
      week: row.week ?? undefined,
      lessonNumber: row.lessonNumber ?? undefined,
      specificCompetence: row.specificCompetence ?? undefined,
      mainActivity: row.mainActivity ?? undefined,
      lessonObjective: row.lessonObjective ?? undefined,
      knowledgeAndSkills: row.knowledgeAndSkills ?? undefined,
      assessmentEvidence: row.assessmentEvidence ?? undefined,
      learningActivities: row.learningActivities ?? undefined,
      misconceptions: row.misconceptions ?? undefined,
      differentiationSupport: row.differentiationSupport ?? undefined,
      resources: row.resources ?? undefined,
      reflection: row.reflection ?? undefined,
      source: "manual",
    };

    if (row.id) {
      // Update existing row.
      const updated = await db
        .update(sowLessons)
        .set(values)
        .where(eq(sowLessons.id, row.id))
        .returning();
      const lessonId = updated[0]?.id;
      if (!lessonId) return actionFailure("not-found");
      revalidatePath("/[locale]/admin/ai-studio/schemes", "page");
      return { ok: true, lessonId };
    } else {
      // Insert new row.
      const inserted = await db
        .insert(sowLessons)
        .values(values)
        .onConflictDoUpdate({
          target: [sowLessons.schemeId, sowLessons.orderIndex],
          set: { ...values },
        })
        .returning();
      const lessonId = inserted[0]?.id;
      revalidatePath("/[locale]/admin/ai-studio/schemes", "page");
      return { ok: true, lessonId };
    }
  } catch (err) {
    return actionFailure("failed", { cause: err });
  }
}

// ── deleteScheme ──────────────────────────────────────────────────────────────

/** Permanently delete a scheme (cascades to sow_lessons). Admin-only. */
export async function deleteScheme(schemeId: string): Promise<ActionResult> {
  await requireAdmin();

  if (!schemeId) return actionFailure("invalid-input");

  try {
    await db.delete(schemesOfWork).where(eq(schemesOfWork.id, schemeId));
    revalidatePath("/[locale]/admin/ai-studio/schemes", "page");
    return { ok: true };
  } catch (err) {
    return actionFailure("failed", { cause: err });
  }
}
