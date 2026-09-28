-- Agentic marketing readiness: UTM on leads/campaigns, public calendar flag,
-- enrolment-window event type, and the parent-facing school-year dates only.

ALTER TABLE school_events DROP CONSTRAINT IF EXISTS school_events_event_type_check;
ALTER TABLE school_events ADD CONSTRAINT school_events_event_type_check
  CHECK (event_type IN (
    'open_day','term_start','term_end','exam_period',
    'sports_day','cultural_day','club_event','trip',
    'welfare_day','public_holiday','enrolment_window','other'
  ));

ALTER TABLE school_events
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS audience VARCHAR(20) NOT NULL DEFAULT 'internal'
    CHECK (audience IN ('marketing','internal','all')),
  ADD COLUMN IF NOT EXISTS source VARCHAR(40) NOT NULL DEFAULT 'manual';

ALTER TABLE marketing_campaigns
  ADD COLUMN IF NOT EXISTS slug VARCHAR(80),
  ADD COLUMN IF NOT EXISTS utm_source VARCHAR(80),
  ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(80),
  ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(80);

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_slug
  ON marketing_campaigns (slug) WHERE slug IS NOT NULL;

ALTER TABLE marketing_leads
  ADD COLUMN IF NOT EXISTS utm_source VARCHAR(80),
  ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(80),
  ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(80),
  ADD COLUMN IF NOT EXISTS landing_page VARCHAR(300);

-- Published admissions windows from silverleaf.co.tz (2027 year now open)
-- plus workbook open-day / tour dates. Internal exams and staff days stay out.

INSERT INTO school_events (campus_id, title, description, event_type, start_date, end_date, location, is_public, audience, source)
SELECT NULL, '2027 applications open',
       'Applications for the 2027 school year are open across all campuses. Daycare and pre-primary enrol any time; primary has two windows.',
       'enrolment_window', '2026-08-01', '2026-12-31', 'All campuses', TRUE, 'marketing', 'academic_year'
WHERE NOT EXISTS (SELECT 1 FROM school_events WHERE title = '2027 applications open');

INSERT INTO school_events (campus_id, title, description, event_type, start_date, end_date, location, is_public, audience, source)
SELECT NULL, 'Primary enrolment — January 2027 start',
       'Parents who want a January start can enrol from October to December.',
       'enrolment_window', '2026-10-01', '2026-12-31', 'All campuses', TRUE, 'marketing', 'academic_year'
WHERE NOT EXISTS (SELECT 1 FROM school_events WHERE title = 'Primary enrolment — January 2027 start');

INSERT INTO school_events (campus_id, title, description, event_type, start_date, end_date, location, is_public, audience, source)
SELECT NULL, 'Primary enrolment — mid-year 2026',
       'Mid-year primary intake window published on the admissions page.',
       'enrolment_window', '2026-06-01', '2026-07-31', 'All campuses', TRUE, 'marketing', 'academic_year'
WHERE NOT EXISTS (SELECT 1 FROM school_events WHERE title = 'Primary enrolment — mid-year 2026');

INSERT INTO school_events (campus_id, title, description, event_type, start_date, end_date, location, is_public, audience, source)
SELECT NULL, 'Primary enrolment — mid-year 2027',
       'Mid-year primary intake for a start after the mid-year break.',
       'enrolment_window', '2027-06-01', '2027-07-31', 'All campuses', TRUE, 'marketing', 'academic_year'
WHERE NOT EXISTS (SELECT 1 FROM school_events WHERE title = 'Primary enrolment — mid-year 2027');

INSERT INTO school_events (campus_id, title, description, event_type, start_date, end_date, location, is_public, audience, source)
SELECT NULL, 'Daycare and pre-primary — rolling intake',
       'Daycare (12 months–3 years) and pre-primary KG1–KG2 can enrol at any time.',
       'enrolment_window', '2026-01-01', '2027-12-31', 'All campuses', TRUE, 'marketing', 'academic_year'
WHERE NOT EXISTS (SELECT 1 FROM school_events WHERE title = 'Daycare and pre-primary — rolling intake');

INSERT INTO school_events (campus_id, title, description, event_type, start_date, end_date, location, is_public, audience, source)
SELECT NULL, 'October 2026 intake campaign',
       'Primary enrolment push for the January 2027 start. Pair campaigns and UTM here.',
       'enrolment_window', '2026-10-01', '2026-10-31', 'All campuses', TRUE, 'marketing', 'academic_year'
WHERE NOT EXISTS (SELECT 1 FROM school_events WHERE title = 'October 2026 intake campaign');

INSERT INTO school_events (campus_id, title, description, event_type, start_date, end_date, location, is_public, audience, source)
SELECT NULL, 'Open Day',
       'From the Marketing Master Dashboard social calendar.',
       'open_day', '2026-03-15', '2026-03-15', 'All campuses', TRUE, 'marketing', 'academic_year'
WHERE NOT EXISTS (SELECT 1 FROM school_events WHERE title = 'Open Day' AND start_date = '2026-03-15');

INSERT INTO school_events (campus_id, title, description, event_type, start_date, end_date, location, is_public, audience, source)
SELECT NULL, 'Campus tour week',
       'Usa River enrolment push from the marketing workbook.',
       'open_day', '2026-04-07', '2026-04-11', 'Usa River Campus', TRUE, 'marketing', 'academic_year'
WHERE NOT EXISTS (SELECT 1 FROM school_events WHERE title = 'Campus tour week' AND start_date = '2026-04-07');
