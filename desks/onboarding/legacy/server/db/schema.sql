-- Silverleaf Onboarding Hub — PostgreSQL schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  campus VARCHAR(100),
  job_title VARCHAR(150),
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_reads (
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  item_id VARCHAR(50) NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (staff_id, item_id)
);

CREATE TABLE IF NOT EXISTS checkpoint_completions (
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  checkpoint_id VARCHAR(50) NOT NULL,
  passed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (staff_id, checkpoint_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
CREATE INDEX IF NOT EXISTS idx_checkpoint_staff ON checkpoint_completions(staff_id);
CREATE INDEX IF NOT EXISTS idx_reads_staff ON document_reads(staff_id);
