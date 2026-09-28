-- ============================================================
-- SILVERLEAF ACADEMY — FULL MIGRATION v3.0
-- Run on a fresh or parallel database
-- ============================================================

BEGIN;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CAMPUSES
-- ============================================================
CREATE TABLE campuses (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    code        VARCHAR(10)  NOT NULL UNIQUE,
    location    VARCHAR(150),
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO campuses (name, code, location) VALUES
    ('Arusha City Campus', 'ACC', 'Arusha'),
    ('Usa River Campus',   'USR', 'USA River'),
    ('Boma',               'BOM', 'Boma'),
    ('Kijenge',            'KJG', 'Kijenge'),
    ('Ilboru',             'ILB', 'Ilboru');

-- ============================================================
-- ROLES
-- ============================================================
CREATE TYPE user_role AS ENUM (
    'ceo',
    'global_marketing_head',
    'campus_marketing_head',
    'global_student_exp_head',
    'campus_student_exp_head',
    'nurse',
    'class_teacher',
    'clubs_patron',
    'daycare_attendee',
    'driver'
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id                   SERIAL PRIMARY KEY,
    uuid                 UUID DEFAULT uuid_generate_v4() UNIQUE,
    name                 VARCHAR(100) NOT NULL,
    email                VARCHAR(120) UNIQUE NOT NULL
                           CHECK (email LIKE '%@silverleaf.co.tz'),
    password_hash        TEXT NOT NULL,
    role                 user_role NOT NULL,
    campus_id            INTEGER REFERENCES campuses(id),   -- NULL = global
    department           VARCHAR(50) CHECK (department IN
                           ('marketing','student_experience','dispensary',
                            'transport','boarding')),
    avatar_url           TEXT,
    phone                VARCHAR(30),
    additional_roles     TEXT[] DEFAULT '{}',
    must_change_password BOOLEAN DEFAULT TRUE,
    is_active            BOOLEAN DEFAULT TRUE,
    last_login           TIMESTAMPTZ,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Default global heads are created by backend/seed.js (real bcrypt hash, must_change_password = TRUE).

-- ============================================================
-- STUDENTS (local stub for SE/dispensary FKs only)
-- Enrolled children live in Ed Admin (GET /api/general/v1/Students + Parents).
-- Marketing must not copy that dump here. After enrolment store
-- marketing_leads.edadmin_student_id / admission_applications.edadmin_ref.
-- ============================================================
CREATE TABLE students (
    id               SERIAL PRIMARY KEY,
    campus_id        INTEGER NOT NULL REFERENCES campuses(id),
    first_name       VARCHAR(80)  NOT NULL,
    last_name        VARCHAR(80)  NOT NULL,
    class_name       VARCHAR(30),
    gender           VARCHAR(10),
    date_of_birth    DATE,
    parent_name      VARCHAR(100),
    parent_phone     VARCHAR(30),
    parent2_name     VARCHAR(100),
    parent2_phone    VARCHAR(30),
    parent_email     VARCHAR(120),
    parent2_email    VARCHAR(120),
    is_boarding      BOOLEAN DEFAULT FALSE,
    is_active        BOOLEAN DEFAULT TRUE,
    edadmin_id       VARCHAR(60),   -- future Ed Admin link
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SCHOOL EVENTS (shared calendar — marketing + SE both use)
-- ============================================================
CREATE TABLE school_events (
    id           SERIAL PRIMARY KEY,
    campus_id    INTEGER REFERENCES campuses(id),  -- NULL = all campuses
    title        VARCHAR(200) NOT NULL,
    description  TEXT,
    event_type   VARCHAR(60) NOT NULL
                   CHECK (event_type IN (
                     'open_day','term_start','term_end','exam_period',
                     'sports_day','cultural_day','club_event','trip',
                     'welfare_day','public_holiday','other'
                   )),
    start_date   DATE NOT NULL,
    end_date     DATE,
    start_time   TIME,
    location     VARCHAR(150),
    created_by   INTEGER REFERENCES users(id),
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MARKETING — LEADS & FUNNEL
-- ============================================================
CREATE TYPE lead_source AS ENUM (
    'walk_in','phone_call','social_media','referral','radio_campaign',
    'billboard','online_form','whatsapp','open_day','partner_school','other'
);

CREATE TABLE feeder_schools (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(150) NOT NULL,
    location   VARCHAR(100),
    type       VARCHAR(50),   -- primary, secondary, competitor
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE marketing_leads (
    id                SERIAL PRIMARY KEY,
    campus_id         INTEGER NOT NULL REFERENCES campuses(id),
    created_by        INTEGER REFERENCES users(id),
    campaign_id       INTEGER,   -- FK added after campaigns table
    -- Parent info
    parent_name       VARCHAR(100) NOT NULL,
    parent_phone      VARCHAR(30),
    parent_phone2     VARCHAR(30),
    parent_email      VARCHAR(120),
    whatsapp_number   VARCHAR(30),
    occupation        VARCHAR(80),
    residence         VARCHAR(100),
    region            VARCHAR(80),
    -- Child info
    child_name        VARCHAR(100),
    child_age         INTEGER,
    child_gender      VARCHAR(10),
    interested_class  VARCHAR(30),
    boarding_day      VARCHAR(10) CHECK (boarding_day IN ('boarding','day')),
    num_children      INTEGER DEFAULT 1,
    -- Funnel engine
    computed_stage    VARCHAR(30) DEFAULT 'lead'
                        CHECK (computed_stage IN (
                          'lead','tour_booked','form_filled',
                          'enrolled','admission_paid','declined','lapsed'
                        )),
    lead_score        INTEGER DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
    -- Source tracking
    source            lead_source DEFAULT 'other',
    source_detail     VARCHAR(200),
    how_heard         VARCHAR(150),
    sibling_flag      BOOLEAN DEFAULT FALSE,
    feeder_school_id  INTEGER REFERENCES feeder_schools(id),
    referrer_id       INTEGER REFERENCES marketing_leads(id),
    -- State
    follow_up_date    DATE,
    notes             TEXT,
    decline_reason    VARCHAR(200),
    assigned_to       INTEGER REFERENCES users(id),
    is_archived       BOOLEAN DEFAULT FALSE,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tour_bookings (
    id               SERIAL PRIMARY KEY,
    lead_id          INTEGER REFERENCES marketing_leads(id),
    campus_id        INTEGER NOT NULL REFERENCES campuses(id),
    booked_by_name   VARCHAR(100),
    booked_by_phone  VARCHAR(30),
    booked_by_email  VARCHAR(120),
    tour_date        DATE NOT NULL,
    tour_time        TIME,
    status           VARCHAR(20) DEFAULT 'confirmed'
                       CHECK (status IN ('confirmed','completed','cancelled','no_show')),
    rating           INTEGER CHECK (rating BETWEEN 1 AND 5),
    feedback         TEXT,
    conducted_by     INTEGER REFERENCES users(id),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admission_applications (
    id               SERIAL PRIMARY KEY,
    lead_id          INTEGER NOT NULL REFERENCES marketing_leads(id),
    campus_id        INTEGER NOT NULL REFERENCES campuses(id),
    -- Form fields matching Google Sheet
    student_first_name  VARCHAR(80),
    student_last_name   VARCHAR(80),
    student_dob         DATE,
    student_gender      VARCHAR(10),
    class_applying_for  VARCHAR(30),
    boarding_preference VARCHAR(10),
    previous_school     VARCHAR(150),
    parent_name         VARCHAR(100),
    parent_phone        VARCHAR(30),
    parent_email        VARCHAR(120),
    parent2_name        VARCHAR(100),
    parent2_phone       VARCHAR(30),
    parent2_email       VARCHAR(120),
    special_needs       TEXT,
    additional_info     TEXT,
    -- Doc checklist
    birth_cert_received     BOOLEAN DEFAULT FALSE,
    photos_received         BOOLEAN DEFAULT FALSE,
    prev_reports_received   BOOLEAN DEFAULT FALSE,
    medical_form_received   BOOLEAN DEFAULT FALSE,
    -- Meta
    submitted_at    TIMESTAMPTZ DEFAULT NOW(),
    ip_address      VARCHAR(45),
    edadmin_ref     VARCHAR(60)   -- future Ed Admin handoff
);

CREATE TABLE admission_payments (
    id               SERIAL PRIMARY KEY,
    lead_id          INTEGER NOT NULL REFERENCES marketing_leads(id),
    campus_id        INTEGER NOT NULL REFERENCES campuses(id),
    amount           NUMERIC(12,2) NOT NULL,
    currency         VARCHAR(5) DEFAULT 'TZS',
    payment_method   VARCHAR(50),   -- mpesa, bank_transfer, cash, other
    reference_number VARCHAR(100),
    paid_at          TIMESTAMPTZ DEFAULT NOW(),
    received_by      INTEGER REFERENCES users(id),
    notes            TEXT,
    edadmin_ref      VARCHAR(60)   -- Ed Admin reconciliation key
);

-- Lead milestone view — auto-classification engine
CREATE OR REPLACE VIEW lead_computed_stages AS
SELECT
    l.id,
    CASE
        WHEN ap.id IS NOT NULL THEN 'admission_paid'
        WHEN aa.id IS NOT NULL THEN 'form_filled'   -- enrolled handled by Ed Admin
        WHEN tb.id IS NOT NULL THEN 'tour_booked'
        ELSE 'lead'
    END AS computed_stage
FROM marketing_leads l
LEFT JOIN LATERAL (
    SELECT id FROM admission_payments WHERE lead_id = l.id LIMIT 1
) ap ON TRUE
LEFT JOIN LATERAL (
    SELECT id FROM admission_applications WHERE lead_id = l.id LIMIT 1
) aa ON TRUE
LEFT JOIN LATERAL (
    SELECT id FROM tour_bookings WHERE lead_id = l.id LIMIT 1
) tb ON TRUE;

-- Trigger to auto-update computed_stage on marketing_leads
CREATE OR REPLACE FUNCTION update_lead_stage() RETURNS TRIGGER AS $$
DECLARE
    v_lead_id INTEGER;
    v_stage   VARCHAR(30);
BEGIN
    IF TG_TABLE_NAME = 'tour_bookings'        THEN v_lead_id := NEW.lead_id;
    ELSIF TG_TABLE_NAME = 'admission_applications' THEN v_lead_id := NEW.lead_id;
    ELSIF TG_TABLE_NAME = 'admission_payments'     THEN v_lead_id := NEW.lead_id;
    END IF;

    IF v_lead_id IS NULL THEN RETURN NEW; END IF;

    SELECT computed_stage INTO v_stage
    FROM lead_computed_stages WHERE id = v_lead_id;

    UPDATE marketing_leads
    SET computed_stage = v_stage, updated_at = NOW()
    WHERE id = v_lead_id
      AND computed_stage NOT IN ('declined','lapsed');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tour_stage
    AFTER INSERT OR UPDATE ON tour_bookings
    FOR EACH ROW EXECUTE FUNCTION update_lead_stage();

CREATE TRIGGER trg_application_stage
    AFTER INSERT OR UPDATE ON admission_applications
    FOR EACH ROW EXECUTE FUNCTION update_lead_stage();

CREATE TRIGGER trg_payment_stage
    AFTER INSERT OR UPDATE ON admission_payments
    FOR EACH ROW EXECUTE FUNCTION update_lead_stage();

-- Lead scoring function
CREATE OR REPLACE FUNCTION compute_lead_score(p_lead_id INTEGER) RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 10;  -- base score for existing
    has_tour      BOOLEAN;
    has_form      BOOLEAN;
    has_payment   BOOLEAN;
    has_email     BOOLEAN;
    has_whatsapp  BOOLEAN;
    follow_up_ok  BOOLEAN;
BEGIN
    SELECT
        EXISTS(SELECT 1 FROM tour_bookings WHERE lead_id = p_lead_id),
        EXISTS(SELECT 1 FROM admission_applications WHERE lead_id = p_lead_id),
        EXISTS(SELECT 1 FROM admission_payments WHERE lead_id = p_lead_id),
        (SELECT parent_email IS NOT NULL FROM marketing_leads WHERE id = p_lead_id),
        (SELECT whatsapp_number IS NOT NULL FROM marketing_leads WHERE id = p_lead_id),
        (SELECT follow_up_date >= CURRENT_DATE FROM marketing_leads WHERE id = p_lead_id)
    INTO has_tour, has_form, has_payment, has_email, has_whatsapp, follow_up_ok;

    IF has_tour     THEN score := score + 25; END IF;
    IF has_form     THEN score := score + 30; END IF;
    IF has_payment  THEN score := score + 25; END IF;
    IF has_email    THEN score := score + 5;  END IF;
    IF has_whatsapp THEN score := score + 5;  END IF;
    IF follow_up_ok THEN score := score + 5;  END IF;

    RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- MARKETING — CAMPAIGNS
-- ============================================================
CREATE TABLE marketing_campaigns (
    id               SERIAL PRIMARY KEY,
    campus_id        INTEGER REFERENCES campuses(id),  -- NULL = all campuses
    name             VARCHAR(150) NOT NULL,
    type             VARCHAR(50) NOT NULL
                       CHECK (type IN ('radio','billboard','social_media',
                                       'email','whatsapp','event','other')),
    description      TEXT,
    start_date       DATE,
    end_date         DATE,
    budget           NUMERIC(12,2) DEFAULT 0,
    spent            NUMERIC(12,2) DEFAULT 0,
    leads_generated  INTEGER DEFAULT 0,
    conversions      INTEGER DEFAULT 0,
    status           VARCHAR(20) DEFAULT 'active'
                       CHECK (status IN ('draft','active','paused','completed')),
    -- Radio specific
    station_name     VARCHAR(100),
    air_times        TEXT,
    -- Billboard specific
    location_desc    VARCHAR(200),
    -- Social specific
    platform         VARCHAR(50),
    ad_account_id    VARCHAR(100),
    created_by       INTEGER REFERENCES users(id),
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Link campaigns to leads after campaigns table exists
ALTER TABLE marketing_leads
    ADD CONSTRAINT fk_lead_campaign
    FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id);

-- ============================================================
-- MARKETING — SOCIAL ANALYTICS (manual + Buffer.com)
-- ============================================================
CREATE TABLE social_analytics (
    id               SERIAL PRIMARY KEY,
    campus_id        INTEGER REFERENCES campuses(id),
    platform         VARCHAR(50) NOT NULL,  -- facebook, instagram, tiktok, twitter, youtube
    date             DATE NOT NULL,
    followers        INTEGER DEFAULT 0,
    reach            INTEGER DEFAULT 0,
    impressions      INTEGER DEFAULT 0,
    engagement_rate  NUMERIC(5,2) DEFAULT 0,
    posts_count      INTEGER DEFAULT 0,
    leads_from_platform INTEGER DEFAULT 0,
    source           VARCHAR(20) DEFAULT 'manual'
                       CHECK (source IN ('manual','puffer','buffer','api')),
    raw_payload      JSONB,   -- store raw Buffer.com payload
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (campus_id, platform, date)
);

-- ============================================================
-- MARKETING — AUTOMATION
-- ============================================================
CREATE TABLE follow_up_tasks (
    id           SERIAL PRIMARY KEY,
    lead_id      INTEGER NOT NULL REFERENCES marketing_leads(id),
    assigned_to  INTEGER REFERENCES users(id),
    task_type    VARCHAR(50) DEFAULT 'follow_up',
    due_date     DATE NOT NULL,
    notes        TEXT,
    status       VARCHAR(20) DEFAULT 'pending'
                   CHECK (status IN ('pending','done','snoozed','cancelled')),
    auto_created BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE drip_sequences (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    trigger_stage VARCHAR(30) NOT NULL,   -- which funnel stage triggers this
    day_offset   INTEGER NOT NULL,        -- days after entering stage
    channel      VARCHAR(20) NOT NULL CHECK (channel IN ('sms','email','whatsapp')),
    subject      VARCHAR(200),
    body         TEXT NOT NULL,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE drip_logs (
    id            SERIAL PRIMARY KEY,
    lead_id       INTEGER NOT NULL REFERENCES marketing_leads(id),
    sequence_id   INTEGER NOT NULL REFERENCES drip_sequences(id),
    sent_at       TIMESTAMPTZ DEFAULT NOW(),
    channel       VARCHAR(20),
    status        VARCHAR(20) DEFAULT 'sent',
    error_msg     TEXT
);

CREATE TABLE waitlist (
    id               SERIAL PRIMARY KEY,
    lead_id          INTEGER NOT NULL REFERENCES marketing_leads(id),
    campus_id        INTEGER NOT NULL REFERENCES campuses(id),
    class_name       VARCHAR(30),
    position         INTEGER,
    notified         BOOLEAN DEFAULT FALSE,
    notified_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE document_checklists (
    id           SERIAL PRIMARY KEY,
    lead_id      INTEGER NOT NULL REFERENCES marketing_leads(id),
    doc_type     VARCHAR(80) NOT NULL,
    received     BOOLEAN DEFAULT FALSE,
    received_at  TIMESTAMPTZ,
    notes        TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STUDENT EXPERIENCE — INCIDENTS (enhanced)
-- ============================================================
CREATE TABLE student_incidents (
    id                      SERIAL PRIMARY KEY,
    campus_id               INTEGER NOT NULL REFERENCES campuses(id),
    student_id              INTEGER NOT NULL REFERENCES students(id),
    reported_by             INTEGER REFERENCES users(id),
    incident_type           VARCHAR(80) NOT NULL
                              CHECK (incident_type IN (
                                'behaviour','safeguarding','medical','bullying',
                                'accident','property_damage','other'
                              )),
    incident_location       VARCHAR(60) NOT NULL
                              CHECK (incident_location IN (
                                'dormitory','dispensary','field','trip','games',
                                'classroom','canteen','transport','laboratory',
                                'office','other'
                              )),
    severity                VARCHAR(20) DEFAULT 'low'
                              CHECK (severity IN ('low','medium','high','critical')),
    description             TEXT NOT NULL,
    action_taken            TEXT,
    involved_students       INTEGER[],  -- additional student IDs
    witnesses               TEXT,
    follow_up_required      BOOLEAN DEFAULT FALSE,
    follow_up_date          DATE,
    parent_notified         BOOLEAN DEFAULT FALSE,
    parent_meeting_required BOOLEAN DEFAULT FALSE,
    referral_required       BOOLEAN DEFAULT FALSE,
    status                  VARCHAR(30) DEFAULT 'open'
                              CHECK (status IN ('open','investigating','resolved','escalated')),
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STUDENT EXPERIENCE — SAFETY WALKTHROUGHS (new)
-- ============================================================
CREATE TABLE safety_walkthroughs (
    id             SERIAL PRIMARY KEY,
    campus_id      INTEGER NOT NULL REFERENCES campuses(id),
    conducted_by   INTEGER REFERENCES users(id),
    walkthrough_date DATE DEFAULT CURRENT_DATE,
    overall_notes  TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE walkthrough_area_findings (
    id               SERIAL PRIMARY KEY,
    walkthrough_id   INTEGER NOT NULL REFERENCES safety_walkthroughs(id) ON DELETE CASCADE,
    area             VARCHAR(80) NOT NULL
                       CHECK (area IN (
                         'dormitories','classrooms','kitchen_canteen',
                         'toilets_bathrooms','sports_fields','science_lab',
                         'transport_bay','administration_block',
                         'medical_room','perimeter_fencing','other'
                       )),
    condition_rating INTEGER NOT NULL CHECK (condition_rating BETWEEN 1 AND 5),
    findings         TEXT,
    risk_level       VARCHAR(20) DEFAULT 'low'
                       CHECK (risk_level IN ('low','medium','high','critical')),
    corrective_action TEXT,
    responsible_person VARCHAR(100),
    deadline         DATE,
    status           VARCHAR(30) DEFAULT 'open'
                       CHECK (status IN ('open','in_progress','resolved')),
    photo_urls       TEXT[] DEFAULT '{}',
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STUDENT EXPERIENCE — BEHAVIOURAL WALKTHROUGHS (new)
-- ============================================================
CREATE TABLE behavioural_walkthroughs (
    id                  SERIAL PRIMARY KEY,
    campus_id           INTEGER NOT NULL REFERENCES campuses(id),
    student_id          INTEGER NOT NULL REFERENCES students(id),
    observed_by         INTEGER REFERENCES users(id),
    observed_at         TIMESTAMPTZ DEFAULT NOW(),
    setting             VARCHAR(60) NOT NULL
                          CHECK (setting IN (
                            'classroom','break_time','dormitory',
                            'sports','assembly','canteen','transport','other'
                          )),
    behaviour_categories TEXT[] DEFAULT '{}',
    description         TEXT NOT NULL,
    frequency           VARCHAR(30)
                          CHECK (frequency IN ('first_time','recurring','established_pattern')),
    trigger_identified  BOOLEAN DEFAULT FALSE,
    trigger_description TEXT,
    intervention        VARCHAR(80)
                          CHECK (intervention IN (
                            'verbal_warning','mediation','counselling_referral',
                            'parent_contact','isolation','commendation','other'
                          )),
    intervention_outcome TEXT,
    parent_contacted    BOOLEAN DEFAULT FALSE,
    parent_contact_date DATE,
    follow_up_date      DATE,
    escalated           BOOLEAN DEFAULT FALSE,
    escalation_notes    TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STUDENT EXPERIENCE — EVENTS & ACTIVITIES REPORTS (new)
-- ============================================================
CREATE TABLE event_activity_reports (
    id                   SERIAL PRIMARY KEY,
    campus_id            INTEGER NOT NULL REFERENCES campuses(id),
    school_event_id      INTEGER REFERENCES school_events(id),
    event_name           VARCHAR(200) NOT NULL,
    report_date          DATE DEFAULT CURRENT_DATE,
    venue                VARCHAR(150),
    student_count        INTEGER,
    staff_count          INTEGER,
    supervision_ratio    NUMERIC(5,2),  -- auto-calc: students/staff
    activities_conducted TEXT,
    engagement_level     VARCHAR(20)
                           CHECK (engagement_level IN ('poor','fair','good','excellent')),
    incidents_occurred   BOOLEAN DEFAULT FALSE,
    incident_ids         INTEGER[],
    health_safety_notes  TEXT,
    recommendations      TEXT,
    overall_rating       INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
    photo_urls           TEXT[] DEFAULT '{}',
    reported_by          INTEGER REFERENCES users(id),
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STUDENT EXPERIENCE — EXISTING TABLES KEPT
-- (behaviour_logs, boarding_welfare_logs, clubs, daycare,
--  residential_walkthroughs, student_recognitions — unchanged)
-- ============================================================
CREATE TABLE student_behaviour_logs (
    id                  SERIAL PRIMARY KEY,
    student_id          INTEGER NOT NULL REFERENCES students(id),
    teacher_id          INTEGER NOT NULL REFERENCES users(id),
    campus_id           INTEGER REFERENCES campuses(id),
    log_date            DATE DEFAULT CURRENT_DATE,
    behaviour_note      TEXT,
    mother_tongue_count INTEGER DEFAULT 0,
    is_sick             BOOLEAN DEFAULT FALSE,
    medical_care_given  TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE boarding_welfare_logs (
    id             SERIAL PRIMARY KEY,
    campus_id      INTEGER NOT NULL REFERENCES campuses(id),
    student_id     INTEGER NOT NULL REFERENCES students(id),
    logged_by      INTEGER REFERENCES users(id),
    log_date       DATE DEFAULT CURRENT_DATE,
    health_status  VARCHAR(20) CHECK (health_status IN ('good','fair','poor')),
    mood_status    VARCHAR(20) CHECK (mood_status IN ('happy','neutral','sad','anxious')),
    meals_taken    BOOLEAN DEFAULT TRUE,
    homework_done  BOOLEAN DEFAULT TRUE,
    notes          TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clubs (
    id               SERIAL PRIMARY KEY,
    campus_id        INTEGER NOT NULL REFERENCES campuses(id),
    name             VARCHAR(100) NOT NULL,
    patron_id        INTEGER REFERENCES users(id),
    description      TEXT,
    roles            TEXT[],
    meeting_schedule VARCHAR(100),
    is_active        BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE club_memberships (
    id            SERIAL PRIMARY KEY,
    club_id       INTEGER NOT NULL REFERENCES clubs(id),
    student_id    INTEGER NOT NULL REFERENCES students(id),
    role_in_club  VARCHAR(60),
    enrolled_date DATE DEFAULT CURRENT_DATE,
    is_active     BOOLEAN DEFAULT TRUE,
    UNIQUE(club_id, student_id)
);

CREATE TABLE club_student_ratings (
    id            SERIAL PRIMARY KEY,
    membership_id INTEGER NOT NULL REFERENCES club_memberships(id),
    term          VARCHAR(20),
    academic_year VARCHAR(10),
    rating        INTEGER CHECK (rating BETWEEN 0 AND 10),
    remarks       TEXT,
    rated_by      INTEGER REFERENCES users(id),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(membership_id, term, academic_year)
);

CREATE TABLE club_skills (
    id          SERIAL PRIMARY KEY,
    club_id     INTEGER NOT NULL REFERENCES clubs(id),
    term        VARCHAR(20),
    skill_name  VARCHAR(100),
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE club_term_photos (
    id            SERIAL PRIMARY KEY,
    club_id       INTEGER NOT NULL REFERENCES clubs(id),
    term          VARCHAR(20),
    academic_year VARCHAR(10),
    photo_urls    TEXT[],
    uploaded_by   INTEGER REFERENCES users(id),
    emails_sent   BOOLEAN DEFAULT FALSE,
    sent_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(club_id, term, academic_year)
);

CREATE TABLE daycare_attendance (
    id                         SERIAL PRIMARY KEY,
    campus_id                  INTEGER NOT NULL REFERENCES campuses(id),
    student_id                 INTEGER NOT NULL REFERENCES students(id),
    attendee_id                INTEGER REFERENCES users(id),
    date                       DATE DEFAULT CURRENT_DATE,
    arrived_at                 TIME,
    departed_at                TIME,
    parent_notified_departure  BOOLEAN DEFAULT FALSE,
    notification_sent_at       TIMESTAMPTZ,
    created_at                 TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, date)
);

CREATE TABLE daycare_development_ratings (
    id                   SERIAL PRIMARY KEY,
    campus_id            INTEGER NOT NULL REFERENCES campuses(id),
    student_id           INTEGER NOT NULL REFERENCES students(id),
    rated_by             INTEGER REFERENCES users(id),
    term                 VARCHAR(20),
    academic_year        VARCHAR(10),
    social_skills        INTEGER CHECK (social_skills BETWEEN 1 AND 5),
    communication        INTEGER CHECK (communication BETWEEN 1 AND 5),
    physical_development INTEGER CHECK (physical_development BETWEEN 1 AND 5),
    emotional_development INTEGER CHECK (emotional_development BETWEEN 1 AND 5),
    cognitive_development INTEGER CHECK (cognitive_development BETWEEN 1 AND 5),
    remarks              TEXT,
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE student_recognitions (
    id             SERIAL PRIMARY KEY,
    campus_id      INTEGER NOT NULL REFERENCES campuses(id),
    student_id     INTEGER NOT NULL REFERENCES students(id),
    nominated_by   INTEGER REFERENCES users(id),
    recognition_type VARCHAR(80),
    criteria       TEXT,
    score          INTEGER,
    term           VARCHAR(20),
    academic_year  VARCHAR(10),
    awarded        BOOLEAN DEFAULT FALSE,
    award_date     DATE,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DISPENSARY
-- ============================================================
CREATE TABLE drug_categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(80) NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO drug_categories (name) VALUES
    ('Pain Relief'),('Antibiotics'),('Antihistamines'),
    ('First Aid'),('Vitamins & Supplements'),('Chronic Medication'),
    ('Antimalaria'),('Other');

CREATE TABLE drug_inventory (
    id               SERIAL PRIMARY KEY,
    campus_id        INTEGER NOT NULL REFERENCES campuses(id),
    category_id      INTEGER REFERENCES drug_categories(id),
    drug_name        VARCHAR(150) NOT NULL,
    quantity         INTEGER DEFAULT 0,
    unit             VARCHAR(30),
    expiry_date      DATE,
    last_restocked   DATE,
    minimum_stock    INTEGER DEFAULT 10,
    reorder_quantity INTEGER DEFAULT 50,
    storage_location VARCHAR(80),
    supplier         VARCHAR(100),
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE drug_purchases (
    id                 SERIAL PRIMARY KEY,
    campus_id          INTEGER NOT NULL REFERENCES campuses(id),
    drug_id            INTEGER NOT NULL REFERENCES drug_inventory(id),
    quantity_purchased INTEGER NOT NULL,
    unit_cost          NUMERIC(10,2),
    total_cost         NUMERIC(12,2),
    supplier           VARCHAR(100),
    purchase_date      DATE DEFAULT CURRENT_DATE,
    received_by        INTEGER REFERENCES users(id),
    invoice_number     VARCHAR(80),
    created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dispensary_visits (
    id                         SERIAL PRIMARY KEY,
    campus_id                  INTEGER NOT NULL REFERENCES campuses(id),
    student_id                 INTEGER NOT NULL REFERENCES students(id),
    nurse_id                   INTEGER REFERENCES users(id),
    visit_date                 DATE DEFAULT CURRENT_DATE,
    visit_time                 TIME DEFAULT CURRENT_TIME,
    visit_type                 VARCHAR(30) DEFAULT 'walk_in'
                                 CHECK (visit_type IN (
                                   'walk_in','follow_up','emergency','routine_check'
                                 )),
    complaint                  TEXT NOT NULL,
    diagnosis                  TEXT,
    prescription               TEXT,
    temperature                NUMERIC(4,1),
    blood_pressure             VARCHAR(20),
    weight                     NUMERIC(5,1),
    is_emergency               BOOLEAN DEFAULT FALSE,
    referred_out               BOOLEAN DEFAULT FALSE,
    referral_id                INTEGER,   -- FK to student_referrals
    remarks                    TEXT,
    emergency_contacts_notified BOOLEAN DEFAULT FALSE,
    created_at                 TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE drug_dispensed (
    id                  SERIAL PRIMARY KEY,
    visit_id            INTEGER NOT NULL REFERENCES dispensary_visits(id),
    drug_id             INTEGER NOT NULL REFERENCES drug_inventory(id),
    quantity_given      INTEGER NOT NULL,
    dosage_instructions TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE student_referrals (
    id                   SERIAL PRIMARY KEY,
    campus_id            INTEGER NOT NULL REFERENCES campuses(id),
    student_id           INTEGER NOT NULL REFERENCES students(id),
    visit_id             INTEGER REFERENCES dispensary_visits(id),
    referred_by          INTEGER REFERENCES users(id),
    referral_date        DATE DEFAULT CURRENT_DATE,
    reason               TEXT NOT NULL,
    referred_to          VARCHAR(150) NOT NULL,   -- hospital/specialist name
    expected_return_date DATE,
    outcome              TEXT,
    outcome_date         DATE,
    status               VARCHAR(20) DEFAULT 'pending'
                           CHECK (status IN ('pending','returned','lost_to_followup')),
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK now that referrals table exists
ALTER TABLE dispensary_visits
    ADD CONSTRAINT fk_visit_referral
    FOREIGN KEY (referral_id) REFERENCES student_referrals(id);

CREATE TABLE chronic_visit_flags (
    id           SERIAL PRIMARY KEY,
    campus_id    INTEGER NOT NULL REFERENCES campuses(id),
    student_id   INTEGER NOT NULL REFERENCES students(id),
    complaint    VARCHAR(200),
    visit_count  INTEGER,
    first_visit  DATE,
    last_visit   DATE,
    acknowledged BOOLEAN DEFAULT FALSE,
    ack_by       INTEGER REFERENCES users(id),
    ack_at       TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE drug_quotations (
    id                    SERIAL PRIMARY KEY,
    campus_id             INTEGER NOT NULL REFERENCES campuses(id),
    created_by            INTEGER REFERENCES users(id),
    title                 VARCHAR(200) NOT NULL,
    notes                 TEXT,
    total_estimated_cost  NUMERIC(12,2),
    status                VARCHAR(20) DEFAULT 'pending'
                            CHECK (status IN ('pending','approved','rejected')),
    reviewed_by           INTEGER REFERENCES users(id),  -- global_student_exp_head
    reviewed_at           TIMESTAMPTZ,
    review_notes          TEXT,
    email_sent            BOOLEAN DEFAULT FALSE,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE drug_quotation_items (
    id                  SERIAL PRIMARY KEY,
    quotation_id        INTEGER NOT NULL REFERENCES drug_quotations(id) ON DELETE CASCADE,
    drug_name           VARCHAR(150) NOT NULL,
    quantity_needed     INTEGER,
    unit                VARCHAR(30) DEFAULT 'tablets',
    estimated_unit_cost NUMERIC(10,2),
    estimated_total     NUMERIC(12,2),
    supplier_suggestion VARCHAR(150),
    notes               TEXT
);

-- Chronic flag trigger
CREATE OR REPLACE FUNCTION check_chronic_visits() RETURNS TRIGGER AS $$
DECLARE
    v_count    INTEGER;
    v_first    DATE;
    v_complaint VARCHAR(200);
BEGIN
    SELECT COUNT(*), MIN(visit_date), (array_agg(complaint ORDER BY visit_date DESC))[1]
    INTO v_count, v_first, v_complaint
    FROM dispensary_visits
    WHERE student_id = NEW.student_id
      AND campus_id  = NEW.campus_id
      AND visit_date >= CURRENT_DATE - INTERVAL '30 days';

    IF v_count >= 3 THEN
        INSERT INTO chronic_visit_flags
            (campus_id, student_id, complaint, visit_count, first_visit, last_visit)
        VALUES
            (NEW.campus_id, NEW.student_id, v_complaint, v_count, v_first, CURRENT_DATE)
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chronic_check
    AFTER INSERT ON dispensary_visits
    FOR EACH ROW EXECUTE FUNCTION check_chronic_visits();

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notification_log (
    id          SERIAL PRIMARY KEY,
    campus_id   INTEGER REFERENCES campuses(id),
    type        VARCHAR(60),
    channel     VARCHAR(20) CHECK (channel IN ('email','sms','whatsapp','socket')),
    recipient   VARCHAR(150),
    subject     VARCHAR(200),
    body        TEXT,
    status      VARCHAR(20) DEFAULT 'sent',
    error_msg   TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE in_app_notifications (
    id          SERIAL PRIMARY KEY,
    campus_id   INTEGER REFERENCES campuses(id),
    user_id     INTEGER REFERENCES users(id),
    type        VARCHAR(60),
    title       VARCHAR(200),
    message     TEXT,
    link        VARCHAR(200),
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MESSAGES (internal)
-- ============================================================
CREATE TABLE messages (
    id           SERIAL PRIMARY KEY,
    sender_id    INTEGER NOT NULL REFERENCES users(id),
    recipient_id INTEGER REFERENCES users(id),
    campus_id    INTEGER REFERENCES campuses(id),
    subject      VARCHAR(200),
    body         TEXT NOT NULL,
    is_broadcast BOOLEAN DEFAULT FALSE,
    is_read      BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRANSPORT (unchanged from original)
-- ============================================================
CREATE TABLE transport_shuttles (
    id               SERIAL PRIMARY KEY,
    campus_id        INTEGER NOT NULL REFERENCES campuses(id),
    driver_id        INTEGER REFERENCES users(id),
    vehicle_plate    VARCHAR(20),
    capacity         INTEGER,
    route_name       VARCHAR(100),
    current_location POINT,
    last_seen        TIMESTAMPTZ,
    is_active        BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE driver_route_trips (
    id            SERIAL PRIMARY KEY,
    shuttle_id    INTEGER NOT NULL REFERENCES transport_shuttles(id),
    campus_id     INTEGER NOT NULL REFERENCES campuses(id),
    trip_type     VARCHAR(20) CHECK (trip_type IN ('pickup','dropoff')),
    started_at    TIMESTAMPTZ DEFAULT NOW(),
    ended_at      TIMESTAMPTZ,
    is_active_now BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE driver_student_boarding_logs (
    id           SERIAL PRIMARY KEY,
    trip_id      INTEGER NOT NULL REFERENCES driver_route_trips(id),
    student_id   INTEGER NOT NULL REFERENCES students(id),
    campus_id    INTEGER REFERENCES campuses(id),
    action       VARCHAR(20) CHECK (action IN ('boarded','alighted')),
    location     POINT,
    timestamp    TIMESTAMPTZ DEFAULT NOW(),
    sms_sent     BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- TRIPS (school trips — unchanged)
-- ============================================================
CREATE TABLE trips (
    id              SERIAL PRIMARY KEY,
    campus_id       INTEGER NOT NULL REFERENCES campuses(id),
    title           VARCHAR(200) NOT NULL,
    destination     VARCHAR(150),
    trip_date       DATE,
    return_date     DATE,
    description     TEXT,
    cost_per_student NUMERIC(10,2),
    status          VARCHAR(20) DEFAULT 'planned'
                      CHECK (status IN ('planned','confirmed','completed','cancelled')),
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trip_participants (
    id              SERIAL PRIMARY KEY,
    trip_id         INTEGER NOT NULL REFERENCES trips(id),
    student_id      INTEGER NOT NULL REFERENCES students(id),
    consent_token   UUID DEFAULT uuid_generate_v4() UNIQUE,
    consent_status  VARCHAR(20) DEFAULT 'pending'
                      CHECK (consent_status IN ('pending','approved','declined')),
    consented_by    VARCHAR(100),
    consented_at    TIMESTAMPTZ,
    email_sent      BOOLEAN DEFAULT FALSE,
    UNIQUE(trip_id, student_id)
);

-- ============================================================
-- PARTNERSHIPS
-- ============================================================
CREATE TABLE partners (
    id              SERIAL PRIMARY KEY,
    campus_id       INTEGER REFERENCES campuses(id),
    name            VARCHAR(150) NOT NULL,
    type            VARCHAR(60),
    contact_name    VARCHAR(100),
    contact_email   VARCHAR(120),
    contact_phone   VARCHAR(30),
    notes           TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_leads_campus       ON marketing_leads(campus_id);
CREATE INDEX idx_leads_stage        ON marketing_leads(computed_stage);
CREATE INDEX idx_leads_score        ON marketing_leads(lead_score DESC);
CREATE INDEX idx_leads_created      ON marketing_leads(created_at DESC);
CREATE INDEX idx_incidents_campus   ON student_incidents(campus_id);
CREATE INDEX idx_incidents_severity ON student_incidents(severity);
CREATE INDEX idx_incidents_status   ON student_incidents(status);
CREATE INDEX idx_walkthroughs_campus ON safety_walkthroughs(campus_id);
CREATE INDEX idx_walkthrough_status ON walkthrough_area_findings(status);
CREATE INDEX idx_dispensary_campus  ON dispensary_visits(campus_id);
CREATE INDEX idx_dispensary_date    ON dispensary_visits(visit_date DESC);
CREATE INDEX idx_dispensary_emergency ON dispensary_visits(is_emergency) WHERE is_emergency = TRUE;
CREATE INDEX idx_notifications_user ON in_app_notifications(user_id, is_read);
CREATE INDEX idx_shuttles_location  ON transport_shuttles USING GIST(current_location);

COMMIT;
