/**
 * import.ts — bulk import of lesson plans from a manifest.
 *
 * Used by:
 *   - the admin import API route (`POST /api/import`), which passes a parsed
 *     JSON manifest straight to {@link importFromManifest}, and
 *   - a direct CLI run for ad-hoc backfills:
 *
 *       npm run db:import -- ./path/to/manifest.json
 *
 * Each manifest entry is a `filename` plus optional metadata. The filename is
 * parsed for the structured fields (grade/subject/term/week/lesson/slug); a
 * malformed filename is collected into `errors` and skipped — it never aborts
 * the batch. Valid rows are inserted in chunks with `onConflictDoNothing` on the
 * unique `slug`, so re-running is idempotent and partially-present manifests are
 * safe.
 *
 * NOTE: this module imports the lazy `db` client (`../client`), which is
 * `server-only`. That is fine for the API route (server) and for the CLI run
 * (plain Node via the resolver hook), but it must never be imported into a
 * Client Component.
 */
import { buildSearchText } from "@/lib/lesson/searchText";
import { parse } from "@/lib/naming/parse";

import { db } from "../client";
import { lessonPlans, type NewLessonPlan } from "../schema";

/** One row of the import manifest. Only `filename` is required. */
export interface ImportManifestEntry {
  filename: string;
  title?: string;
  topic?: string;
  durationMinutes?: number;
  objectives?: string[];
  contentMarkdown?: string;
  blobUrl?: string;
}

/** Outcome of an import run. */
export interface ImportResult {
  /** Rows sent to the database (before conflict resolution). */
  inserted: number;
  /** Entries skipped because the filename failed to parse. */
  skipped: number;
  /** The skipped entries, each with a human-readable reason. */
  errors: { filename: string; reason: string }[];
}

/** Max rows per INSERT — keeps statements well under driver/param limits. */
const CHUNK_SIZE = 500;

/** Split an array into fixed-size chunks. */
function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Import lesson plans from a manifest.
 *
 * Returns counts of `inserted` (rows we attempted to insert) and `skipped`
 * (filenames that failed validation), plus the per-entry `errors`. Insertion
 * uses `onConflictDoNothing` on `slug`, so the returned `inserted` count is the
 * number of well-formed rows submitted — duplicates already present are simply
 * ignored by the database and require no special handling here.
 *
 * @param entries the manifest entries (typically a parsed JSON array).
 */
export async function importFromManifest(
  entries: ImportManifestEntry[],
): Promise<ImportResult> {
  const errors: { filename: string; reason: string }[] = [];
  const rows: NewLessonPlan[] = [];

  for (const entry of entries) {
    const filename = entry?.filename;

    if (typeof filename !== "string" || filename.trim() === "") {
      errors.push({
        filename: String(filename ?? ""),
        reason: "Missing or empty filename",
      });
      continue;
    }

    const parsed = parse(filename);
    if (!parsed.ok) {
      errors.push({ filename, reason: parsed.reason });
      continue;
    }

    const { grade, gradeNum, subject, term, termOrdinal, week, lesson, slug } =
      parsed.value;

    // Fall back to the filename as a human title when none is provided, so a
    // bare-filename manifest still yields a usable (if plain) catalogue row.
    const title = entry.title?.trim() || filename;
    const topic = entry.topic?.trim() || null;
    const objectives = entry.objectives ?? null;
    const contentMarkdown = entry.contentMarkdown ?? "";

    const searchText = buildSearchText({
      subject,
      grade,
      term,
      title,
      topic,
      objectives,
      contentMarkdown,
    });

    rows.push({
      slug,
      filename,
      grade,
      gradeNum,
      subject,
      term,
      termOrdinal,
      week,
      lesson,
      title,
      topic,
      objectives,
      durationMinutes: entry.durationMinutes ?? null,
      contentMarkdown,
      status: "published",
      source: "import",
      blobUrl: entry.blobUrl ?? null,
      searchText,
    });
  }

  for (const batch of chunk(rows, CHUNK_SIZE)) {
    await db.insert(lessonPlans).values(batch).onConflictDoNothing({
      target: lessonPlans.slug,
    });
  }

  return { inserted: rows.length, skipped: errors.length, errors };
}

// ---------------------------------------------------------------------------
// CLI guard — run directly with a manifest path: `node import.ts manifest.json`
// ---------------------------------------------------------------------------

/**
 * Detect a direct `node import.ts <manifest.json>` invocation. We treat any
 * extra `process.argv` argument that is not a flag as a manifest path. Guarded
 * so importing this module (API route, tests) never triggers a run.
 */
function manifestPathFromArgv(): string | undefined {
  // argv: [node, scriptPath, ...rest]
  const rest = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  return rest[0];
}

async function main(): Promise<void> {
  const manifestPath = manifestPathFromArgv();
  if (!manifestPath) {
    console.error(
      "[db:import] usage: node import.ts <path-to-manifest.json>\n" +
        "  manifest = JSON array of { filename, title?, topic?, durationMinutes?, objectives?, contentMarkdown?, blobUrl? }",
    );
    process.exit(1);
    return;
  }

  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const abs = path.resolve(process.cwd(), manifestPath);

  const raw = await readFile(abs, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Manifest at ${abs} must be a JSON array`);
  }

  const { runMigrations } = await import("../migrate");
  const { driver } = await runMigrations();
  console.log(`[db:import] migrations applied via ${driver} driver`);

  const result = await importFromManifest(parsed as ImportManifestEntry[]);
  console.log(
    `[db:import] inserted=${result.inserted} skipped=${result.skipped}`,
  );
  if (result.errors.length > 0) {
    console.log("[db:import] errors:");
    for (const e of result.errors) {
      console.log(`  - ${e.filename}: ${e.reason}`);
    }
  }
  console.log("[db:import] done");
}

// Only run when executed as the entry module, not when imported. Under the
// db-script resolver this file is the process entry point, so comparing the
// resolved argv[1] basename is a robust, dependency-light guard.
const isDirectRun =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  /(?:^|[\\/])import\.ts$/.test(process.argv[1] ?? "");

if (isDirectRun) {
  main()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error("[db:import] failed:", err);
      process.exit(1);
    });
}
