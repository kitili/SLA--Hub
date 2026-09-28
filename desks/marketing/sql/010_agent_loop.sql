-- Approve-before-send agent loop. Drafts are stored; nothing is sent
-- until a marketing user approves. No Ed Admin student dump.

CREATE TABLE IF NOT EXISTS agent_actions (
    id           SERIAL PRIMARY KEY,
    lead_id      INTEGER NOT NULL REFERENCES marketing_leads(id) ON DELETE CASCADE,
    campus_id    INTEGER REFERENCES campuses(id),
    action_type  VARCHAR(40) NOT NULL
                   CHECK (action_type IN (
                     'send_whatsapp','send_sms','send_email',
                     'send_form_link','mark_dead','log_contact'
                   )),
    status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','rejected','executed','skipped')),
    payload      JSONB NOT NULL DEFAULT '{}',
    result       TEXT,
    proposed_by  INTEGER REFERENCES users(id),
    reviewed_by  INTEGER REFERENCES users(id),
    executed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_lead
  ON agent_actions(lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_actions_status
  ON agent_actions(status, created_at DESC);
