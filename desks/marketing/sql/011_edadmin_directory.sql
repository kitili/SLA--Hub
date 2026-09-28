-- Ed Admin GET /api/general/v1/Parents + Students, stored locally
-- so marketing can relate a parent_id to many students and to leads.

CREATE TABLE IF NOT EXISTS edadmin_parents (
    id              SERIAL PRIMARY KEY,
    edadmin_id      VARCHAR(60) NOT NULL UNIQUE,
    first_name      VARCHAR(80),
    last_name       VARCHAR(80),
    full_name       VARCHAR(160),
    phone           VARCHAR(40),
    phone2          VARCHAR(40),
    email           VARCHAR(120),
    campus_name     VARCHAR(120),
    synced_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edadmin_students (
    id                  SERIAL PRIMARY KEY,
    edadmin_id          VARCHAR(60) NOT NULL UNIQUE,
    parent_edadmin_id   VARCHAR(60) REFERENCES edadmin_parents(edadmin_id) ON DELETE SET NULL,
    first_name          VARCHAR(80),
    last_name           VARCHAR(80),
    class_name          VARCHAR(40),
    gender              VARCHAR(10),
    campus_name         VARCHAR(120),
    synced_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edadmin_students_parent
  ON edadmin_students(parent_edadmin_id);
CREATE INDEX IF NOT EXISTS idx_edadmin_parents_phone
  ON edadmin_parents(phone);

ALTER TABLE marketing_leads
  ADD COLUMN IF NOT EXISTS edadmin_parent_id VARCHAR(60);

CREATE INDEX IF NOT EXISTS idx_leads_edadmin_parent
  ON marketing_leads(edadmin_parent_id);
