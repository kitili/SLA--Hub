-- Ed Admin owns enrolled students (GET /api/general/v1/Students + Parents).
-- Marketing keeps only the SIS id after enrolment — never a student dump.

ALTER TABLE marketing_leads
  ADD COLUMN IF NOT EXISTS edadmin_student_id VARCHAR(60);

-- Strip real child/parent names that were copied from the 2026 Staff Referrals tab.
WITH referral_rows AS (
  SELECT id FROM marketing_leads
  WHERE notes = 'From 2026 Staff Referrals tab'
     OR parent_name IN (
       'Janeana Prosper', 'Happiness Mungure', 'Lisa Franco', 'Kennedy Michael',
       'Frank Issangya', 'Ester Kingu', 'Zainabu Wahabi Msangi', 'Anna William',
       'Elly Andrea'
     )
     OR child_name IN (
       'Taimoor Athuman Mwinyi', 'Skylar Athuman Mwinyi', 'Catherine Chawe',
       'Coniah Chawe', 'Ethaline Elirehema Melejack', 'Manaal Ahmed Mahmud',
       'Andreas Patrick Issangya', 'Julius Godfrey Masolwa', 'Sadick Mohamed Msangi',
       'Brielle Mutatiro Kumbata', 'Gracious James Urio', 'Given James Urio'
     )
)
UPDATE admission_applications a
SET student_first_name = 'Child',
    student_last_name  = 'Student',
    parent_name        = 'Referral parent'
WHERE a.lead_id IN (SELECT id FROM referral_rows);

WITH referral_rows AS (
  SELECT id FROM marketing_leads
  WHERE notes = 'From 2026 Staff Referrals tab'
     OR parent_name IN (
       'Janeana Prosper', 'Happiness Mungure', 'Lisa Franco', 'Kennedy Michael',
       'Frank Issangya', 'Ester Kingu', 'Zainabu Wahabi Msangi', 'Anna William',
       'Elly Andrea'
     )
     OR child_name IN (
       'Taimoor Athuman Mwinyi', 'Skylar Athuman Mwinyi', 'Catherine Chawe',
       'Coniah Chawe', 'Ethaline Elirehema Melejack', 'Manaal Ahmed Mahmud',
       'Andreas Patrick Issangya', 'Julius Godfrey Masolwa', 'Sadick Mohamed Msangi',
       'Brielle Mutatiro Kumbata', 'Gracious James Urio', 'Given James Urio'
     )
)
UPDATE marketing_leads
SET parent_name   = 'Referral parent',
    child_name    = 'Child',
    source_detail = 'Staff referral',
    updated_at    = NOW()
WHERE id IN (SELECT id FROM referral_rows);

-- Anonymize leftover seed directory rows. Do not drop students — SE/dispensary FKs.
UPDATE students
SET first_name  = 'Demo',
    last_name   = 'Student ' || id::text,
    parent_name = 'Demo parent'
WHERE parent_phone LIKE '+25571234500%';
