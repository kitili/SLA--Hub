import "server-only";

import { curriculumSql } from "@/lib/curriculum-db";
import { withOfflineCache, type Loaded } from "@/lib/curriculum-offline";

import type { LeadershipPayload } from "./schema";

/**
 * Instructional Leadership Dashboard storage, in the Academics Neon database
 * beside assessment_records and kg_records. Same statements as
 * db/neon/0001_instructional_leadership.sql.
 */

/** The two shapes of the Neon client this module needs, so tests can supply PGlite. */
export type LeadershipSql = {
  (strings: TemplateStringsArray, ...values: unknown[]): PromiseLike<unknown[]>;
  transaction: (queries: PromiseLike<unknown[]>[]) => PromiseLike<unknown[]>;
};

const KEEP_SYNC_LOG_ROWS = 200;

export async function ensureLeadershipTables(sql: LeadershipSql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS ild_walkthroughs (
      record_id TEXT PRIMARY KEY,
      seq INTEGER NOT NULL,
      walk_date TEXT NOT NULL DEFAULT '',
      term TEXT NOT NULL DEFAULT '',
      campus TEXT NOT NULL DEFAULT '',
      facilitator TEXT NOT NULL DEFAULT '',
      payload JSONB NOT NULL,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS ild_observations (
      record_id TEXT PRIMARY KEY,
      seq INTEGER NOT NULL,
      obs_date TEXT NOT NULL DEFAULT '',
      campus TEXT NOT NULL DEFAULT '',
      teacher TEXT NOT NULL DEFAULT '',
      observer TEXT NOT NULL DEFAULT '',
      payload JSONB NOT NULL,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS ild_config (
      key TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS ild_sync_log (
      id BIGSERIAL PRIMARY KEY,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      walkthroughs INTEGER NOT NULL DEFAULT 0,
      observations INTEGER NOT NULL DEFAULT 0
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS ild_walkthroughs_campus_term_idx ON ild_walkthroughs (campus, term)`;
  await sql`CREATE INDEX IF NOT EXISTS ild_observations_campus_date_idx ON ild_observations (campus, obs_date)`;
}

/**
 * Replaces the stored snapshot with this payload. The delete and the inserts
 * run in one transaction, so a failed push leaves the last good snapshot.
 */
export async function replaceLeadershipSnapshot(
  sql: LeadershipSql,
  payload: LeadershipPayload,
): Promise<{ walkthroughs: number; observations: number }> {
  await ensureLeadershipTables(sql);

  const { walkthroughs, observations, ...rest } = payload;
  const walkJson = JSON.stringify(walkthroughs);
  const obsJson = JSON.stringify(observations);
  const configJson = JSON.stringify(rest);

  await sql.transaction([
    sql`DELETE FROM ild_walkthroughs`,
    sql`DELETE FROM ild_observations`,
    sql`
      INSERT INTO ild_walkthroughs (record_id, seq, walk_date, term, campus, facilitator, payload)
      SELECT 'w-' || r.ord, r.ord::int, r.payload->>'date', r.payload->>'term',
             r.payload->>'campus', r.payload->>'facilitator', r.payload
      FROM jsonb_array_elements(${walkJson}::jsonb) WITH ORDINALITY AS r(payload, ord)
    `,
    sql`
      INSERT INTO ild_observations (record_id, seq, obs_date, campus, teacher, observer, payload)
      SELECT 'o-' || r.ord, r.ord::int, r.payload->>'date', r.payload->>'campus',
             r.payload->>'teacher', r.payload->>'observer', r.payload
      FROM jsonb_array_elements(${obsJson}::jsonb) WITH ORDINALITY AS r(payload, ord)
    `,
    sql`
      INSERT INTO ild_config (key, payload, updated_at)
      SELECT c.key, c.value, now() FROM jsonb_each(${configJson}::jsonb) AS c
      ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
    `,
    sql`INSERT INTO ild_sync_log (walkthroughs, observations) VALUES (${walkthroughs.length}, ${observations.length})`,
    sql`DELETE FROM ild_sync_log WHERE id NOT IN (SELECT id FROM ild_sync_log ORDER BY id DESC LIMIT ${KEEP_SYNC_LOG_ROWS})`,
  ]);

  return { walkthroughs: walkthroughs.length, observations: observations.length };
}

type PayloadRow = { payload: unknown };
type ConfigRow = { key: string; payload: unknown };

/** The stored snapshot in the shape the dashboard page reads, or null before the first push. */
export async function readLeadershipSnapshot(sql: LeadershipSql): Promise<LeadershipPayload | null> {
  await ensureLeadershipTables(sql);
  const [walks, obs, config] = await Promise.all([
    sql`SELECT payload FROM ild_walkthroughs ORDER BY seq`,
    sql`SELECT payload FROM ild_observations ORDER BY seq`,
    sql`SELECT key, payload FROM ild_config`,
  ]);
  const settings = new Map((config as ConfigRow[]).map((row) => [row.key, row.payload]));
  if (!settings.has("generatedAt")) return null;
  return {
    campuses: (settings.get("campuses") ?? []) as LeadershipPayload["campuses"],
    terms: (settings.get("terms") ?? []) as LeadershipPayload["terms"],
    pdLists: (settings.get("pdLists") ?? { management: [], rigor: [] }) as LeadershipPayload["pdLists"],
    walkthroughs: (walks as PayloadRow[]).map((row) => row.payload) as LeadershipPayload["walkthroughs"],
    walkOffline: (settings.get("walkOffline") ?? []) as LeadershipPayload["walkOffline"],
    observations: (obs as PayloadRow[]).map((row) => row.payload) as LeadershipPayload["observations"],
    obsRules: (settings.get("obsRules") ?? {
      range: { start: "", end: "" },
      allowancePerTeacher: 0,
      teachers: {},
      roster: {},
    }) as LeadershipPayload["obsRules"],
    generatedAt: String(settings.get("generatedAt")),
    sources: (settings.get("sources") ?? []) as LeadershipPayload["sources"],
  };
}

export function leadershipSql(): LeadershipSql | null {
  return curriculumSql() as unknown as LeadershipSql | null;
}

/** Reads the live snapshot; if Neon cannot be reached, the last copy kept on the server. */
export async function loadLeadershipSnapshot(): Promise<Loaded<LeadershipPayload> | null> {
  const sql = leadershipSql();
  const loaded = await withOfflineCache<LeadershipPayload | null>(
    "leadership-live.json",
    sql ? () => readLeadershipSnapshot(sql) : null,
    (data) => data != null,
  );
  if (!loaded || loaded.data == null) return null;
  return { data: loaded.data, source: loaded.source };
}
