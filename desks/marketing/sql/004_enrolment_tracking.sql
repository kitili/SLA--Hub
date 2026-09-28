-- ============================================================
-- ENROLMENT TRACKING
-- Distinguishes leads manually marked "enrolled" by staff from
-- ones confirmed via the Ed Admin webhook, so the two paths can
-- coexist without one silently overwriting the other.
-- ============================================================
ALTER TABLE admission_applications
  ADD COLUMN IF NOT EXISTS enrolment_source VARCHAR(20) CHECK (enrolment_source IN ('manual', 'edadmin')),
  ADD COLUMN IF NOT EXISTS enrolled_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrolled_by       INTEGER REFERENCES users(id);
