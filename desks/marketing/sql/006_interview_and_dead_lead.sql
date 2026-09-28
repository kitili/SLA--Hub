-- ============================================================
-- FUNNEL REDESIGN — Interested Lead / Dead Lead / Interview
--
-- 'lead' renamed to 'interested_lead'.
-- New branch stage 'dead_lead': an interested lead that stays
-- dormant 90+ days despite intervention (set automatically by a
-- cron job in server.js, sticky like declined/lapsed).
-- New stage 'interview_booked': a separate step after the campus
-- tour where staff book + manually grade a pass/fail interview.
-- Failing does not end the funnel — staff can rebook another
-- interview_bookings row for the same lead.
-- ============================================================

ALTER TABLE marketing_leads DROP CONSTRAINT IF EXISTS marketing_leads_computed_stage_check;

UPDATE marketing_leads SET computed_stage = 'interested_lead' WHERE computed_stage = 'lead';

ALTER TABLE marketing_leads ALTER COLUMN computed_stage SET DEFAULT 'interested_lead';

ALTER TABLE marketing_leads ADD CONSTRAINT marketing_leads_computed_stage_check
  CHECK (computed_stage IN (
    'interested_lead','dead_lead','tour_booked','interview_booked',
    'form_filled','enrolled','admission_paid','declined','lapsed'
  ));

CREATE TABLE interview_bookings (
    id               SERIAL PRIMARY KEY,
    lead_id          INTEGER NOT NULL REFERENCES marketing_leads(id),
    campus_id        INTEGER NOT NULL REFERENCES campuses(id),
    interview_date   DATE NOT NULL,
    interview_time   TIME,
    status           VARCHAR(20) DEFAULT 'scheduled'
                       CHECK (status IN ('scheduled','completed','cancelled')),
    outcome          VARCHAR(10) DEFAULT 'pending'
                       CHECK (outcome IN ('pending','passed','failed')),
    notes            TEXT,
    conducted_by     INTEGER REFERENCES users(id),
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_interview_lead ON interview_bookings(lead_id);

-- Re-point the auto-classification view through the new interview step.
-- Uses the most recent interview row so a rebooked interview (after a
-- failed one) still counts as "interview_booked" going forward.
CREATE OR REPLACE VIEW lead_computed_stages AS
SELECT
    l.id,
    CASE
        WHEN ap.id IS NOT NULL THEN 'admission_paid'
        WHEN aa.id IS NOT NULL AND aa.enrolled_at IS NOT NULL THEN 'enrolled'
        WHEN aa.id IS NOT NULL THEN 'form_filled'
        WHEN ib.id IS NOT NULL THEN 'interview_booked'
        WHEN tb.id IS NOT NULL THEN 'tour_booked'
        ELSE 'interested_lead'
    END AS computed_stage
FROM marketing_leads l
LEFT JOIN LATERAL (
    SELECT id FROM admission_payments WHERE lead_id = l.id LIMIT 1
) ap ON TRUE
LEFT JOIN LATERAL (
    SELECT id, enrolled_at FROM admission_applications WHERE lead_id = l.id LIMIT 1
) aa ON TRUE
LEFT JOIN LATERAL (
    SELECT id FROM interview_bookings WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1
) ib ON TRUE
LEFT JOIN LATERAL (
    SELECT id FROM tour_bookings WHERE lead_id = l.id LIMIT 1
) tb ON TRUE;

-- Trigger guard now also protects the cron-set 'dead_lead' stage from
-- being clobbered by a stale recompute, same as declined/lapsed.
CREATE OR REPLACE FUNCTION update_lead_stage() RETURNS TRIGGER AS $$
DECLARE
    v_lead_id INTEGER;
    v_stage   VARCHAR(30);
BEGIN
    IF TG_TABLE_NAME = 'tour_bookings'            THEN v_lead_id := NEW.lead_id;
    ELSIF TG_TABLE_NAME = 'interview_bookings'     THEN v_lead_id := NEW.lead_id;
    ELSIF TG_TABLE_NAME = 'admission_applications' THEN v_lead_id := NEW.lead_id;
    ELSIF TG_TABLE_NAME = 'admission_payments'     THEN v_lead_id := NEW.lead_id;
    END IF;

    IF v_lead_id IS NULL THEN RETURN NEW; END IF;

    SELECT computed_stage INTO v_stage
    FROM lead_computed_stages WHERE id = v_lead_id;

    UPDATE marketing_leads
    SET computed_stage = v_stage, updated_at = NOW()
    WHERE id = v_lead_id
      AND computed_stage NOT IN ('declined','lapsed','dead_lead');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_interview_stage
    AFTER INSERT OR UPDATE ON interview_bookings
    FOR EACH ROW EXECUTE FUNCTION update_lead_stage();
