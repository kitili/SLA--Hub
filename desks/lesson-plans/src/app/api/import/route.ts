/**
 * POST /api/import
 *
 * Admin-only bulk import of lesson plans from a JSON manifest.
 *
 * Body: a JSON array of manifest entries —
 *   { filename: string; title?; topic?; durationMinutes?; objectives?;
 *     contentMarkdown?; blobUrl? }[]
 *
 * Each entry's `filename` is parsed for its structured fields; malformed
 * filenames are reported in `errors` and skipped (the rest still import).
 * Inserts use `onConflictDoNothing` on the unique slug, so re-posting the same
 * manifest is idempotent.
 *
 * Response: { inserted: number; skipped: number; errors: { filename, reason }[] }
 *
 * Runs on the Node.js runtime because the import path touches the `server-only`
 * Drizzle client (PGlite/postgres-js), which is not Edge-compatible.
 */
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";

import { importFromManifest, type ImportManifestEntry } from "@/lib/db/scripts/import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  // Throws/redirects for non-admins; the catch below turns auth denials into
  // a clean 403 rather than a 500.
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json(
      { error: "Forbidden: admin access required" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!Array.isArray(body)) {
    return NextResponse.json(
      { error: "Body must be a JSON array of manifest entries" },
      { status: 400 },
    );
  }

  const result = await importFromManifest(body as ImportManifestEntry[]);
  return NextResponse.json(result);
}
