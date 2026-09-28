/**
 * CLI: bulk-import the pre-OCR'd Markdown textbook corpus into the databank.
 *
 *   npm run db:import-textbooks            # default corpus dir ./Textbooks_Markdown
 *   npm run db:import-textbooks -- <dir>   # custom corpus root
 *
 * The corpus (see Textbooks_Markdown/README.md) is 37 Tanzanian primary
 * textbooks (Grades 1–5) already OCR'd to Markdown by Gemini 3.5 Flash. Each
 * book is one `<Subject>.md` (pages delimited by `--- PAGE n ---`, n = scan
 * page) with a sibling `<Subject>.index.json` giving chapter -> scan-page
 * ranges. This loads them as `textbooks` + `textbook_pages` records that are
 * indistinguishable from rows produced by the live OCR ingest workflow
 * (src/lib/ai/workflows/textbookIngest.ts), so the AI Studio picker can use
 * them immediately — no PDF upload / re-OCR needed.
 *
 * Idempotent: a book is matched by (gradeNum, subject, title) and reused;
 * pages upsert on the unique (textbookId, pageNumber) index. Re-runs update in
 * place, never duplicate.
 *
 * Populates whichever DB `DATABASE_URL` targets (PGlite locally; set
 * DATABASE_URL to load Neon/Postgres).
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

import { and, eq, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { db } from "../client";
import { runMigrations } from "../migrate";
import { textbooks, textbookPages } from "../schema";

const DEFAULT_CORPUS_DIR = "./Textbooks_Markdown";
const PUBLISHER = "Tanzania Institute of Education";
/** Canonical OpenRouter slug we record for these pages (engine line is short). */
const OCR_MODEL_SLUG = "google/gemini-3.5-flash";
/** Insert pages this many at a time to keep statements small. */
const PAGE_CHUNK = 200;

interface ParsedPage {
  pageNumber: number;
  content: string;
  heading: string | null;
}

/** A `(scan page number) -> chapter title | null` lookup built from index.json. */
type ChapterResolver = (scan: number) => string | null;

interface IndexChapter {
  title?: string;
  scan_start?: number;
  scan_end?: number;
}
interface IndexJson {
  confidence?: string;
  chapters?: IndexChapter[];
}

/**
 * Reference the conflicting row's incoming value (`EXCLUDED.col`) in an upsert
 * SET, so one static SET clause applies each row's new data across a chunk.
 * The name is derived from the Drizzle column so a schema rename can't
 * silently desync the raw SQL.
 */
function excluded(column: PgColumn) {
  return sql.raw(`excluded.${column.name}`);
}

/**
 * Human-readable subject from a file stem. Underscores -> spaces; a trailing
 * `_2` (the corpus's "second book" convention, e.g. `HTM_2`, `Geography_2`)
 * becomes a " (Book 2)" suffix.
 */
function subjectFromStem(stem: string): string {
  const m = stem.match(/^(.*)_2$/);
  if (m) return `${(m[1] ?? "").replace(/_/g, " ")} (Book 2)`;
  return stem.replace(/_/g, " ");
}

/** Numeric grade from a `Grade_N` directory name, or null if not matching. */
function gradeNumFromDir(dir: string): number | null {
  const m = dir.match(/^Grade_(\d+)$/);
  return m ? Number(m[1]) : null;
}

/** First ATX heading (`#`..`######`) in a page body, else null. */
function firstHeading(body: string): string | null {
  for (const line of body.split("\n")) {
    const m = line.match(/^#{1,6}\s+(.+?)\s*$/);
    if (m) return (m[1] ?? "").trim();
  }
  return null;
}

/**
 * Split a book's Markdown into pages on `--- PAGE n ---` markers. The preamble
 * before the first marker (the `<!-- engine: … -->` line) is discarded.
 */
function splitPages(text: string): ParsedPage[] {
  const re = /^--- PAGE (\d+) ---[ \t]*$/gm;
  const pages: ParsedPage[] = [];
  const matches = [...text.matchAll(re)];
  for (const [i, m] of matches.entries()) {
    const marker = m[0] ?? "";
    const pageNumber = Number(m[1] ?? "0");
    const bodyStart = (m.index ?? 0) + marker.length;
    const next = matches[i + 1];
    const bodyEnd = next ? (next.index ?? text.length) : text.length;
    const content = text.slice(bodyStart, bodyEnd).trim();
    pages.push({ pageNumber, content, heading: firstHeading(content) });
  }
  return pages;
}

/**
 * Build a chapter resolver from a `<Subject>.index.json`. Missing file or no
 * usable chapters -> resolver returns null for every page (front/back matter
 * and indexless books simply carry no chapter).
 */
function loadChapterResolver(indexPath: string): ChapterResolver {
  if (!existsSync(indexPath)) return () => null;
  let parsed: IndexJson;
  try {
    parsed = JSON.parse(readFileSync(indexPath, "utf8")) as IndexJson;
  } catch (err) {
    console.warn(`[db:import-textbooks]   ! bad index json ${indexPath}: ${String(err)}`);
    return () => null;
  }
  const chapters = (parsed.chapters ?? []).filter(
    (c): c is Required<Pick<IndexChapter, "scan_start" | "scan_end">> & IndexChapter =>
      typeof c.scan_start === "number" && typeof c.scan_end === "number",
  );
  if (chapters.length === 0) return () => null;
  return (scan: number) => {
    const hit = chapters.find((c) => scan >= c.scan_start! && scan <= c.scan_end!);
    return hit?.title?.trim() || null;
  };
}

/** Find an existing book by its natural key, or null. */
async function findBookId(
  gradeNum: number,
  subject: string,
  title: string,
): Promise<string | null> {
  const rows = await db
    .select({ id: textbooks.id })
    .from(textbooks)
    .where(
      and(
        eq(textbooks.gradeNum, gradeNum),
        eq(textbooks.subject, subject),
        eq(textbooks.title, title),
      ),
    )
    .limit(1);
  return rows[0]?.id ?? null;
}

interface BookResult {
  title: string;
  pages: number;
  created: boolean;
}

/** Import one `<Subject>.md` file as a book + its page records. */
async function importBook(
  mdPath: string,
  gradeNum: number,
): Promise<BookResult> {
  const stem = basename(mdPath, ".md");
  const subject = subjectFromStem(stem);
  const title = `Grade ${gradeNum} ${subject}`;

  const text = readFileSync(mdPath, "utf8");
  const pages = splitPages(text);
  if (pages.length === 0) {
    throw new Error(`no "--- PAGE n ---" markers found in ${mdPath}`);
  }
  const chapterFor = loadChapterResolver(mdPath.replace(/\.md$/, ".index.json"));

  // Upsert the book container (find-or-create by natural key).
  const now = new Date();
  const meta = {
    title,
    subject,
    grade: String(gradeNum),
    gradeNum,
    publisher: PUBLISHER,
    pageCount: pages.length,
    status: "ready",
    pagesProcessed: pages.length,
    ocrModel: OCR_MODEL_SLUG,
    error: null,
    updatedAt: now,
  } as const;

  const existingId = await findBookId(gradeNum, subject, title);
  const created = existingId === null;
  let bookId: string;
  if (existingId) {
    await db.update(textbooks).set(meta).where(eq(textbooks.id, existingId));
    bookId = existingId;
  } else {
    // NB: no column selection — the dual-driver `db` union only exposes the
    // parameterless `.returning()` overload.
    const inserted = await db.insert(textbooks).values(meta).returning();
    // `.returning()` always yields the inserted row.
    bookId = inserted[0]!.id;
  }

  // Upsert pages on the unique (textbookId, pageNumber) index, in chunks.
  const values = pages.map((p) => ({
    textbookId: bookId,
    pageNumber: p.pageNumber,
    chapter: chapterFor(p.pageNumber),
    heading: p.heading,
    content: p.content,
    keywords: null,
    imageKey: null,
    thumbKey: null,
    ocrModel: OCR_MODEL_SLUG,
    ocrAt: now,
    source: "ocr" as const,
    updatedAt: now,
  }));

  for (let i = 0; i < values.length; i += PAGE_CHUNK) {
    const chunk = values.slice(i, i + PAGE_CHUNK);
    await db
      .insert(textbookPages)
      .values(chunk)
      .onConflictDoUpdate({
        target: [textbookPages.textbookId, textbookPages.pageNumber],
        set: {
          chapter: excluded(textbookPages.chapter),
          heading: excluded(textbookPages.heading),
          content: excluded(textbookPages.content),
          keywords: excluded(textbookPages.keywords),
          imageKey: excluded(textbookPages.imageKey),
          thumbKey: excluded(textbookPages.thumbKey),
          ocrModel: excluded(textbookPages.ocrModel),
          ocrAt: excluded(textbookPages.ocrAt),
          source: excluded(textbookPages.source),
          // Explicit batch timestamp (one `now` per run) — wins over $onUpdate.
          updatedAt: now,
        },
      });
  }

  return { title, pages: pages.length, created };
}

async function main(): Promise<void> {
  const corpusDir = process.argv[2] ?? DEFAULT_CORPUS_DIR;
  if (!existsSync(corpusDir)) {
    throw new Error(`corpus directory not found: ${corpusDir}`);
  }

  const { driver } = await runMigrations();
  console.log(`[db:import-textbooks] migrations applied via ${driver} driver`);
  console.log(`[db:import-textbooks] importing from ${corpusDir}`);

  const gradeDirs = readdirSync(corpusDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^Grade_\d+$/.test(d.name))
    .map((d) => d.name)
    .sort();

  let totalBooks = 0;
  let totalPages = 0;
  let createdBooks = 0;

  for (const gradeDir of gradeDirs) {
    const gradeNum = gradeNumFromDir(gradeDir);
    if (gradeNum === null) continue;
    const dirPath = join(corpusDir, gradeDir);
    const mdFiles = readdirSync(dirPath)
      .filter((f) => f.endsWith(".md"))
      .sort();

    for (const md of mdFiles) {
      const res = await importBook(join(dirPath, md), gradeNum);
      totalBooks += 1;
      totalPages += res.pages;
      if (res.created) createdBooks += 1;
      console.log(
        `[db:import-textbooks]   ${res.created ? "+" : "~"} ${res.title} — ${res.pages} pages`,
      );
    }
  }

  console.log(
    `[db:import-textbooks] done: ${totalBooks} books (${createdBooks} new, ` +
      `${totalBooks - createdBooks} updated), ${totalPages} pages`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error("[db:import-textbooks] failed:", err);
    process.exit(1);
  });
