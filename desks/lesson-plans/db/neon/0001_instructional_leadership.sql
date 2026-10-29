-- Instructional Leadership Dashboard tables, in the Academics Neon database
-- (CURRICULUM_DATABASE_URL), beside assessment_records, kg_records,
-- curriculum_feedback, curriculum_coverage and pd_feedback.
--
-- Additive and idempotent. src/lib/leadership/store.ts runs the same
-- statements on first use, so applying this file by hand is optional.
--
-- Data is replaced as one snapshot by POST /api/leadership/ingest, inside a
-- single transaction, so readers never see a half-written push.

CREATE TABLE IF NOT EXISTS ild_walkthroughs (
  record_id TEXT PRIMARY KEY,
  seq INTEGER NOT NULL,
  walk_date TEXT NOT NULL DEFAULT '',
  term TEXT NOT NULL DEFAULT '',
  campus TEXT NOT NULL DEFAULT '',
  facilitator TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ild_observations (
  record_id TEXT PRIMARY KEY,
  seq INTEGER NOT NULL,
  obs_date TEXT NOT NULL DEFAULT '',
  campus TEXT NOT NULL DEFAULT '',
  teacher TEXT NOT NULL DEFAULT '',
  observer TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per setting: campuses, terms, pdLists, walkOffline, obsRules, sources, generatedAt.
CREATE TABLE IF NOT EXISTS ild_config (
  key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per push. Counts only; never the content.
CREATE TABLE IF NOT EXISTS ild_sync_log (
  id BIGSERIAL PRIMARY KEY,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  walkthroughs INTEGER NOT NULL DEFAULT 0,
  observations INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ild_walkthroughs_campus_term_idx ON ild_walkthroughs (campus, term);
CREATE INDEX IF NOT EXISTS ild_observations_campus_date_idx ON ild_observations (campus, obs_date);
