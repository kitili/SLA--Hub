-- Preserve existing access when switching from roles to modules: hod/tech previously had
-- full working access to Tickets, Tech Tools, and Systems (just not the admin-only Settings
-- pages), so give them equivalent module rows now instead of dropping them to zero access.
-- Admin accounts need no rows — role = 'admin' always bypasses the module system.
INSERT INTO user_modules (user_id, module, level)
SELECT id, 'tickets'::module, 'manage'::access_level FROM users WHERE role = 'hod'
UNION ALL SELECT id, 'tech_tools'::module, 'manage'::access_level FROM users WHERE role = 'hod'
UNION ALL SELECT id, 'systems'::module, 'manage'::access_level FROM users WHERE role = 'hod'
UNION ALL SELECT id, 'tickets'::module, 'view'::access_level FROM users WHERE role = 'tech'
UNION ALL SELECT id, 'tech_tools'::module, 'view'::access_level FROM users WHERE role = 'tech'
UNION ALL SELECT id, 'systems'::module, 'view'::access_level FROM users WHERE role = 'tech';
