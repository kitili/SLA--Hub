-- ============================================================
-- LEAD FORM-FILL REMINDER SEQUENCE
-- Tracks the automated nudge sequence sent to a lead after
-- marketing staff sends them the admission form link, so a
-- cron job can follow up (day 3, day 7) until they submit,
-- pay, or the lead is declined/lapsed.
-- ============================================================
CREATE TABLE IF NOT EXISTS lead_form_reminders (
    id             SERIAL PRIMARY KEY,
    lead_id        INTEGER NOT NULL UNIQUE REFERENCES marketing_leads(id) ON DELETE CASCADE,
    started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    step           INTEGER NOT NULL DEFAULT 0,
    stopped        BOOLEAN NOT NULL DEFAULT FALSE,
    stopped_reason VARCHAR(30),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
