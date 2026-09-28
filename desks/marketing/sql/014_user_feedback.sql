-- In-app feedback for every signed-in role (ops-style pilot notes).
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS user_feedback (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module      VARCHAR(40),
    page_path   VARCHAR(300),
    category    VARCHAR(40) NOT NULL DEFAULT 'general'
                  CHECK (category IN ('bug', 'idea', 'question', 'general')),
    message     TEXT NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'reviewed', 'done')),
    admin_note  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_user
  ON user_feedback(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_feedback_status
  ON user_feedback(status, created_at DESC);
