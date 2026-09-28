/**
 * Seed the example scheme(s) of work by parsing the committed source docx.
 *
 * Runs the real upload pipeline (`parseSowDocx`) rather than hand-authored
 * fixtures, so a seeded scheme is byte-for-byte what an admin gets from
 * AI Studio → Schemes → upload. The parser is the single source of truth; if it
 * changes, the seed follows.
 *
 * Only `grade2-health-environment-sow.docx` is seeded. The Arithmetic source is
 * committed alongside it but deliberately NOT seeded: it is mid-revision and
 * carries two parallel week sets (a rewritten 11-column set covering Weeks 1–3
 * and an older 9-column draft covering Weeks 2–6) plus ten blank week templates.
 * Parsing it yields a scheme that mixes both — Weeks 1–2 from the revision,
 * Weeks 3–5 from the draft, with lesson numbers colliding across weeks. Seed it
 * once the document's revision is finished.
 *
 * Idempotent: skips insert when a scheme already exists for the same
 * (gradeNum, subject, termOrdinal).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { and, eq } from "drizzle-orm";

import { TERM_ORDINAL, type Term } from "@/lib/naming/constants";
import { parseSowDocx } from "@/lib/sow/parse";

import { db } from "../client";
import { schemesOfWork, sowLessons, type NewSowLesson } from "../schema";

/** Repo-root-relative directory holding the source scheme documents. */
const SOW_DIR = "SOW-examples";

/** The scheme documents to seed. */
const SCHEME_FILES = ["grade2-health-environment-sow.docx"] as const;

/** A seeded scheme's identity, returned so plans can link to its rows. */
export interface SeededScheme {
  id: string;
  subject: string;
  /** Parsed rows in document order, for resolving `schemeLessonId`. */
  lessons: { id: string; week: number | null; orderIndex: number }[];
}

/**
 * Normalise a parsed term label to a {@link Term} token: the docx writes "1A",
 * the app stores "1a".
 */
function toTerm(raw: string | undefined): Term {
  const t = (raw ?? "").trim().toLowerCase();
  if (t === "1a" || t === "1b" || t === "2a" || t === "2b") return t;
  throw new Error(
    `[db:seed] scheme term "${raw}" is not one of 1a, 1b, 2a, 2b — cannot file the scheme.`,
  );
}

/** First run of digits in a grade label ("Grade 2" → 2). */
function toGradeNum(raw: string | undefined): number {
  const n = parseInt((raw ?? "").replace(/\D/g, ""), 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(
      `[db:seed] scheme grade "${raw}" has no usable grade number.`,
    );
  }
  return n;
}

/**
 * Parse and insert every {@link SCHEME_FILES} entry.
 *
 * @returns One {@link SeededScheme} per scheme now in the DB (inserted or
 *   pre-existing), so callers can wire `lesson_plans.scheme_lesson_id`.
 */
export async function seedSchemes(): Promise<SeededScheme[]> {
  const seeded: SeededScheme[] = [];

  for (const file of SCHEME_FILES) {
    const buf = await readFile(path.join(process.cwd(), SOW_DIR, file));
    const parsed = await parseSowDocx(buf);

    const subject = parsed.scheme.subject?.trim();
    if (!subject) {
      throw new Error(`[db:seed] ${file}: no subject in the metadata grid.`);
    }
    const gradeNum = toGradeNum(parsed.scheme.grade);
    const term = toTerm(parsed.scheme.term);
    const termOrdinal = TERM_ORDINAL[term];

    // Idempotent: one scheme per (grade, subject, term).
    const [existing] = await db
      .select({ id: schemesOfWork.id })
      .from(schemesOfWork)
      .where(
        and(
          eq(schemesOfWork.gradeNum, gradeNum),
          eq(schemesOfWork.subject, subject),
          eq(schemesOfWork.termOrdinal, termOrdinal),
        ),
      )
      .limit(1);

    let schemeId = existing?.id;

    if (!schemeId) {
      const inserted = await db
        .insert(schemesOfWork)
        .values({
          title: `${parsed.scheme.grade ?? `Grade ${gradeNum}`} ${subject} — Term ${term.toUpperCase()}`,
          grade: parsed.scheme.grade ?? `Grade ${gradeNum}`,
          gradeNum,
          subject,
          term,
          termOrdinal,
          year: parsed.scheme.year,
          mainCompetence: parsed.scheme.mainCompetence,
          weeksCount: parsed.scheme.weeksCount,
          lessonsPerWeek: parsed.scheme.lessonsPerWeek,
          lessonDurationMins: parsed.scheme.lessonDurationMins,
          totalLessons: parsed.scheme.totalLessons,
          headerContext: parsed.headerContext,
          sourceFilename: file,
        })
        .returning();

      const newId = inserted[0]?.id;
      if (!newId) {
        throw new Error(`[db:seed] ${file}: insert returned no scheme id.`);
      }
      schemeId = newId;

      const lessonRows: NewSowLesson[] = parsed.rows.map((r, i) => ({
        schemeId: newId,
        orderIndex: i,
        week: r.week ?? null,
        lessonNumber: r.lessonNumber ?? null,
        specificCompetence: r.specificCompetence ?? null,
        mainActivity: r.mainActivity ?? null,
        lessonObjective: r.lessonObjective ?? null,
        knowledgeAndSkills: r.knowledgeAndSkills ?? null,
        assessmentEvidence: r.assessmentEvidence ?? null,
        learningActivities: r.learningActivities ?? null,
        misconceptions: r.misconceptions ?? null,
        differentiationSupport: r.differentiationSupport ?? null,
        resources: r.resources ?? null,
        reflection: r.reflection ?? null,
        source: "parsed",
        rawCells: r.rawCells,
      }));

      if (lessonRows.length > 0) {
        await db.insert(sowLessons).values(lessonRows);
      }

      console.log(
        `[db:seed] scheme "${subject}" G${gradeNum} T${term}: ` +
          `${lessonRows.length} lessons ` +
          `(week tables kept=${parsed.stats.weekTablesKept} dropped=${parsed.stats.weekTablesDropped})`,
      );
    } else {
      console.log(
        `[db:seed] scheme "${subject}" G${gradeNum} T${term} already present; skipped`,
      );
    }

    const lessons = await db
      .select({
        id: sowLessons.id,
        week: sowLessons.week,
        orderIndex: sowLessons.orderIndex,
      })
      .from(sowLessons)
      .where(eq(sowLessons.schemeId, schemeId))
      .orderBy(sowLessons.orderIndex);

    seeded.push({ id: schemeId, subject, lessons });
  }

  return seeded;
}
