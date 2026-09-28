-- Contact log + remaining lead fields so dead/potential is based on
-- "we actually spoke", not only updated_at. All ADD COLUMN IF NOT EXISTS
-- so this is safe to re-run.

ALTER TABLE marketing_leads
  ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_contact_channel VARCHAR(20),
  ADD COLUMN IF NOT EXISTS last_contact_outcome VARCHAR(30),
  ADD COLUMN IF NOT EXISTS intended_term VARCHAR(40),
  ADD COLUMN IF NOT EXISTS dead_reason VARCHAR(200);

CREATE TABLE IF NOT EXISTS lead_contact_attempts (
    id         SERIAL PRIMARY KEY,
    lead_id    INTEGER NOT NULL REFERENCES marketing_leads(id) ON DELETE CASCADE,
    channel    VARCHAR(20) NOT NULL
                 CHECK (channel IN ('phone','whatsapp','email','sms','in_person','dm')),
    outcome    VARCHAR(30) NOT NULL
                 CHECK (outcome IN ('replied','no_answer','invalid','callback','left_message','declined_talk')),
    notes      TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_attempts_lead
  ON lead_contact_attempts(lead_id, created_at DESC);

INSERT INTO feeder_schools (name, location, type)
SELECT v.name, v.location, v.type
FROM (VALUES
  ('Delice day care', 'Arusha', 'daycare'),
  ('Toddlers day care', 'Arusha', 'daycare'),
  ('Staff referral', 'Internal', 'referral')
) AS v(name, location, type)
WHERE NOT EXISTS (SELECT 1 FROM feeder_schools f WHERE f.name = v.name);
