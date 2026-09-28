-- SQL to add all user accounts to Silverleaf Academy
-- Default Password for ALL accounts: TalentAcademy2024!
-- 
-- Instructions:
-- 1. Go to Database pane in Replit
-- 2. Select "Development database" (or "Production database")
-- 3. Click "My data" tab
-- 4. Toggle "Edit" mode
-- 5. Paste ALL of this SQL and execute
-- 
-- IMPORTANT: Copy the entire SQL block below (all INSERT statements)

-- ============ ADMIN ACCOUNTS (3) ============
-- Username: aloyce | Email: aloyce@silverleaf.co.tz | Password: TalentAcademy2024!
-- Username: anthonia | Email: anthonia@silverleaf.co.tz | Password: TalentAcademy2024!
-- Username: paul | Email: paul@silverleaf.co.tz | Password: TalentAcademy2024!

INSERT INTO users (username, password, email, role, approval_status, approved_at, approved_by) VALUES
('aloyce', '$2b$10$zz.EZK7n/rT/zDhfDvEeIeXZ4M6X8xL.e.0KQQfU8X8qKqKQ7R9ru', 'aloyce@silverleaf.co.tz', 'admin', 'approved', NOW(), 'aloyce'),
('anthonia', '$2b$10$zz.EZK7n/rT/zDhfDvEeIeXZ4M6X8xL.e.0KQQfU8X8qKqKQ7R9ru', 'anthonia@silverleaf.co.tz', 'admin', 'approved', NOW(), 'anthonia'),
('paul', '$2b$10$zz.EZK7n/rT/zDhfDvEeIeXZ4M6X8xL.e.0KQQfU8X8qKqKQ7R9ru', 'paul@silverleaf.co.tz', 'admin', 'approved', NOW(), 'paul');

-- ============ TRAINER ACCOUNTS (2) ============
-- Username: aloyce.trainer | Email: aloyce@silverleaf.co.tz | Password: TalentAcademy2024!
-- Username: anthonia.trainer | Email: anthonia@silverleaf.co.tz | Password: TalentAcademy2024!

INSERT INTO users (username, password, email, role, approval_status, approved_at, approved_by) VALUES
('aloyce.trainer', '$2b$10$zz.EZK7n/rT/zDhfDvEeIeXZ4M6X8xL.e.0KQQfU8X8qKqKQ7R9ru', 'aloyce@silverleaf.co.tz', 'trainer', 'approved', NOW(), 'system'),
('anthonia.trainer', '$2b$10$zz.EZK7n/rT/zDhfDvEeIeXZ4M6X8xL.e.0KQQfU8X8qKqKQ7R9ru', 'anthonia@silverleaf.co.tz', 'trainer', 'approved', NOW(), 'system');

-- ============ TEACHER ACCOUNTS (10) ============
-- All teachers use Password: TalentAcademy2024!

INSERT INTO teachers (name, email, password, teacher_id, approval_status, approved_by, approved_by_role, approved_at) VALUES
('Agapit Respig', 'respig@silverleaf.co.tz', '$2b$10$zz.EZK7n/rT/zDhfDvEeIeXZ4M6X8xL.e.0KQQfU8X8qKqKQ7R9ru', 7100, 'approved', 'system', 'admin', NOW()),
('Godfrey Mulokozi', 'godfrey@silverleaf.co.tz', '$2b$10$zz.EZK7n/rT/zDhfDvEeIeXZ4M6X8xL.e.0KQQfU8X8qKqKQ7R9ru', 7101, 'approved', 'system', 'admin', NOW()),
('Wiliam Mnyika', 'wiliam@silverleaf.co.tz', '$2b$10$zz.EZK7n/rT/zDhfDvEeIeXZ4M6X8xL.e.0KQQfU8X8qKqKQ7R9ru', 7102, 'approved', 'system', 'admin', NOW()),
('Catherine Mrema', 'catherinemrema@silverleaf.co.tz', '$2b$10$zz.EZK7n/rT/zDhfDvEeIeXZ4M6X8xL.e.0KQQfU8X8qKqKQ7R9ru', 7103, 'approved', 'system', 'admin', NOW()),
('Paulo Mwaigaga', 'paulmwaigaga@silverleaf.co.tz', '$2b$10$zz.EZK7n/rT/zDhfDvEeIeXZ4M6X8xL.e.0KQQfU8X8qKqKQ7R9ru', 7104, 'approved', 'system', 'admin', NOW()),
('Innocent Wilfred Massawe', 'innocent-talentacademy@silverleaf.co.tz', '$2b$10$zz.EZK7n/rT/zDhfDvEeIeXZ4M6X8xL.e.0KQQfU8X8qKqKQ7R9ru', 7105, 'approved', 'system', 'admin', NOW()),
('Juliana Nyamkala', 'juliana-talentacademy@silverleaf.co.tz', '$2b$10$zz.EZK7n/rT/zDhfDvEeIeXZ4M6X8xL.e.0KQQfU8X8qKqKQ7R9ru', 7106, 'approved', 'system', 'admin', NOW()),
('Jofrey Wilfred Mulokozi', 'jofrey-talentacademy@silverleaf.co.tz', '$2b$10$zz.EZK7n/rT/zDhfDvEeIeXZ4M6X8xL.e.0KQQfU8X8qKqKQ7R9ru', 7107, 'approved', 'system', 'admin', NOW()),
('Neema Minja', 'neemaminja@silverleaf.co.tz', '$2b$10$zz.EZK7n/rT/zDhfDvEeIeXZ4M6X8xL.e.0KQQfU8X8qKqKQ7R9ru', 7108, 'approved', 'system', 'admin', NOW()),
('Daniel Fredrick', 'danielfm@silverleaf.co.tz', '$2b$10$zz.EZK7n/rT/zDhfDvEeIeXZ4M6X8xL.e.0KQQfU8X8qKqKQ7R9ru', 7109, 'approved', 'system', 'admin', NOW());
