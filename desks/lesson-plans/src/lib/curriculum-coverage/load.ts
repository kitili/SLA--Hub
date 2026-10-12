import "server-only";

import { curriculumSql } from "@/lib/curriculum-db";
import { withOfflineCache, type Loaded } from "@/lib/curriculum-offline";
import type { CoveragePayload } from "./model";

async function readLiveCoverage(): Promise<CoveragePayload | null> {
  const sql = curriculumSql();
  if (!sql) return null;
  await sql`
    CREATE TABLE IF NOT EXISTS curriculum_coverage (
      id TEXT PRIMARY KEY,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      payload JSONB NOT NULL
    )
  `;
  const rows = await sql`SELECT generated_at, payload FROM curriculum_coverage WHERE id = 'current'`;
  const row = rows[0] as { generated_at: string; payload: CoveragePayload } | undefined;
  if (!row) return null;
  return { ...row.payload, generatedAt: row.payload.generatedAt || row.generated_at };
}

export async function loadCoverage(): Promise<Loaded<CoveragePayload> | null> {
  const sql = curriculumSql();
  const loaded = await withOfflineCache(
    "coverage.json",
    sql ? readLiveCoverage : null,
    (payload) => payload != null,
  );
  if (!loaded || loaded.data == null) return null;
  return { data: loaded.data, source: loaded.source };
}
