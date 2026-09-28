-- Finish feedback list/update queries (ops-style filters + resolved-by).
-- Safe to re-run.

ALTER TABLE user_feedback
  ADD COLUMN IF NOT EXISTS resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

ALTER TABLE user_feedback DROP CONSTRAINT IF EXISTS user_feedback_status_check;
ALTER TABLE user_feedback
  ADD CONSTRAINT user_feedback_status_check
  CHECK (status IN ('open', 'reviewed', 'in_progress', 'done'));

UPDATE user_feedback SET status = 'in_progress' WHERE status = 'reviewed';

CREATE INDEX IF NOT EXISTS idx_user_feedback_module
  ON user_feedback(module, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_feedback_category
  ON user_feedback(category, created_at DESC);
