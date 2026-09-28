-- Align ticketing DB with Ops Ticket Desk frontend (UUID PKs + full status fields).
-- Safe to re-run. Applied against the assessment base schema.

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS assigned_to TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by TEXT,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by TEXT,
  ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS declined_by TEXT;

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_settings" ON settings;
DROP POLICY IF EXISTS "anon_requests" ON requests;
DROP POLICY IF EXISTS "anon_messages" ON messages;

CREATE POLICY "anon_settings" ON settings FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_requests" ON requests FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_messages" ON messages FOR ALL TO anon USING (true) WITH CHECK (true);

-- Default manager PIN: Ops2026
INSERT INTO settings(key, value) VALUES
  ('pin_salt', 'silverleaf_ops_salt_v1'),
  ('manager_pin_hash', '5ed995e13af18cd70f3db881e3d785957310bebaf811e566f0b70ead8098236c'),
  ('ops_manager_email', 'baraka@silverleaf.co.tz'),
  ('ops_manager_phone', '+255762711796')
ON CONFLICT (key) DO NOTHING;
