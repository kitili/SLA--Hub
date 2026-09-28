-- Security hardening: store AES-GCM ciphertext for bio PII, enable RLS.
-- ENABLE (not FORCE) so the table-owner DATABASE_URL role still works.
-- Policies apply to a future least-privilege role that is not the owner.
-- PUBLIC is revoked so anonymous DB users cannot read tables.

ALTER TABLE "member_profiles" ALTER COLUMN "home_phone" TYPE text;
--> statement-breakpoint
ALTER TABLE "member_profiles" ALTER COLUMN "mobile_phone" TYPE text;
--> statement-breakpoint
ALTER TABLE "member_profiles" ALTER COLUMN "identification_no" TYPE text;
--> statement-breakpoint
ALTER TABLE "member_profiles" ALTER COLUMN "driving_permit_no" TYPE text;
--> statement-breakpoint
ALTER TABLE "member_profiles" ALTER COLUMN "nssf_no" TYPE text;
--> statement-breakpoint
ALTER TABLE "member_profiles" ALTER COLUMN "tin_no" TYPE text;
--> statement-breakpoint
ALTER TABLE "member_profiles" ALTER COLUMN "nhif_no" TYPE text;
--> statement-breakpoint
ALTER TABLE "member_profiles" ALTER COLUMN "account_number" TYPE text;
--> statement-breakpoint
ALTER TABLE "member_profiles" ALTER COLUMN "mobile_money_number" TYPE text;
--> statement-breakpoint
ALTER TABLE "member_spouses" ALTER COLUMN "phone" TYPE text;
--> statement-breakpoint
ALTER TABLE "member_children" ALTER COLUMN "contact_number" TYPE text;
--> statement-breakpoint
ALTER TABLE "member_family_contacts" ALTER COLUMN "phone" TYPE text;
--> statement-breakpoint
ALTER TABLE "member_emergency_contacts" ALTER COLUMN "phone" TYPE text;
--> statement-breakpoint
ALTER TABLE "member_references" ALTER COLUMN "phone" TYPE text;
--> statement-breakpoint
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE '__drizzle%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  CREATE POLICY staff_self ON staff
    USING (
      current_setting('app.is_admin', true) = 'true'
      OR id::text = current_setting('app.current_staff_id', true)
    )
    WITH CHECK (
      current_setting('app.is_admin', true) = 'true'
      OR id::text = current_setting('app.current_staff_id', true)
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE POLICY member_profiles_self ON member_profiles
    USING (
      current_setting('app.is_admin', true) = 'true'
      OR member_id::text = current_setting('app.current_staff_id', true)
    )
    WITH CHECK (
      current_setting('app.is_admin', true) = 'true'
      OR member_id::text = current_setting('app.current_staff_id', true)
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE POLICY document_reads_self ON document_reads
    USING (
      current_setting('app.is_admin', true) = 'true'
      OR staff_id::text = current_setting('app.current_staff_id', true)
    )
    WITH CHECK (
      current_setting('app.is_admin', true) = 'true'
      OR staff_id::text = current_setting('app.current_staff_id', true)
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE POLICY checkpoint_completions_self ON checkpoint_completions
    USING (
      current_setting('app.is_admin', true) = 'true'
      OR staff_id::text = current_setting('app.current_staff_id', true)
    )
    WITH CHECK (
      current_setting('app.is_admin', true) = 'true'
      OR staff_id::text = current_setting('app.current_staff_id', true)
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE POLICY quiz_attempts_self ON quiz_attempts
    USING (
      current_setting('app.is_admin', true) = 'true'
      OR member_id::text = current_setting('app.current_staff_id', true)
    )
    WITH CHECK (
      current_setting('app.is_admin', true) = 'true'
      OR member_id::text = current_setting('app.current_staff_id', true)
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
-- Hiring pipeline: HR-admin only. Public apply may INSERT new/incomplete rows
-- without tokens. SELECT/UPDATE/DELETE require app.is_admin for a future
-- least-privilege DATABASE_PUBLIC_URL role (table owner still bypasses RLS).
DO $$
BEGIN
  CREATE POLICY hiring_candidates_insert ON hiring_candidates
    FOR INSERT
    WITH CHECK (
      current_setting('app.is_admin', true) = 'true'
      OR (
        stage IN ('new', 'incomplete_application')
        AND culture_token IS NULL
        AND performance_token IS NULL
        AND it_onboarding_token IS NULL
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE POLICY hiring_candidates_admin ON hiring_candidates
    FOR ALL
    USING (current_setting('app.is_admin', true) = 'true')
    WITH CHECK (current_setting('app.is_admin', true) = 'true');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE POLICY hiring_events_admin ON hiring_pipeline_events
    FOR ALL
    USING (current_setting('app.is_admin', true) = 'true')
    WITH CHECK (current_setting('app.is_admin', true) = 'true');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE POLICY hiring_events_insert ON hiring_pipeline_events
    FOR INSERT
    WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE POLICY hiring_tasks_admin ON hiring_performance_tasks
    FOR ALL
    USING (current_setting('app.is_admin', true) = 'true')
    WITH CHECK (current_setting('app.is_admin', true) = 'true');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE POLICY job_openings_admin ON job_openings
    FOR ALL
    USING (current_setting('app.is_admin', true) = 'true')
    WITH CHECK (current_setting('app.is_admin', true) = 'true');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE POLICY job_applications_admin ON job_applications
    FOR ALL
    USING (current_setting('app.is_admin', true) = 'true')
    WITH CHECK (current_setting('app.is_admin', true) = 'true');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
-- Remaining tables: catalog read, member-owned rows, OTP, token-gated hiring.
-- DML is granted back to PUBLIC so a non-owner DATABASE_PUBLIC_URL role can
-- operate; RLS (not table privileges) is the row lock.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO PUBLIC;
--> statement-breakpoint
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO PUBLIC;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO PUBLIC;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO PUBLIC;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_is_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT current_setting('app.is_admin', true) = 'true'
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_staff_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT current_setting('app.current_staff_id', true)
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_hiring_token() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT current_setting('app.hiring_token', true)
$$;
--> statement-breakpoint
DROP POLICY IF EXISTS hiring_events_insert ON hiring_pipeline_events;
--> statement-breakpoint
DO $$
BEGIN
  CREATE POLICY hiring_candidates_token ON hiring_candidates
    FOR SELECT
    USING (
      app_is_admin()
      OR (
        app_hiring_token() <> ''
        AND (
          culture_token = app_hiring_token()
          OR performance_token = app_hiring_token()
          OR it_onboarding_token = app_hiring_token()
        )
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE POLICY hiring_candidates_token_update ON hiring_candidates
    FOR UPDATE
    USING (
      app_is_admin()
      OR (
        app_hiring_token() <> ''
        AND (
          culture_token = app_hiring_token()
          OR performance_token = app_hiring_token()
          OR it_onboarding_token = app_hiring_token()
        )
      )
    )
    WITH CHECK (
      app_is_admin()
      OR (
        app_hiring_token() <> ''
        AND (
          culture_token = app_hiring_token()
          OR performance_token = app_hiring_token()
          OR it_onboarding_token = app_hiring_token()
        )
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'campuses',
    'sections',
    'section_items',
    'materials',
    'quizzes',
    'quiz_questions',
    'quiz_options',
    'roles',
    'item_role_visibility',
    'content_versions',
    'policy_briefings',
    'sla_bot_knowledge'
  ]
  LOOP
    BEGIN
      EXECUTE format('CREATE POLICY catalog_read ON %I FOR SELECT USING (true)', t);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      EXECUTE format(
        'CREATE POLICY catalog_write ON %I FOR INSERT WITH CHECK (app_is_admin())',
        t
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      EXECUTE format(
        'CREATE POLICY catalog_update ON %I FOR UPDATE USING (app_is_admin()) WITH CHECK (app_is_admin())',
        t
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      EXECUTE format(
        'CREATE POLICY catalog_delete ON %I FOR DELETE USING (app_is_admin())',
        t
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;
--> statement-breakpoint
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'member_roles',
    'policy_signatures',
    'section_declarations',
    'onboarding_feedback',
    'signoffs',
    'sla_bot_conversations',
    'sla_bot_alerts'
  ]
  LOOP
    BEGIN
      EXECUTE format(
        'CREATE POLICY member_self ON %I USING (app_is_admin() OR member_id::text = app_staff_id()) WITH CHECK (app_is_admin() OR member_id::text = app_staff_id())',
        t
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;
--> statement-breakpoint
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'member_documents',
    'member_spouses',
    'member_children',
    'member_family_contacts',
    'member_emergency_contacts',
    'member_relatives_employed',
    'member_qualifications',
    'member_employment_history',
    'member_references'
  ]
  LOOP
    BEGIN
      EXECUTE format(
        $f$CREATE POLICY profile_self ON %I
          USING (
            app_is_admin()
            OR member_profile_id IN (
              SELECT id FROM member_profiles WHERE member_id::text = app_staff_id()
            )
          )
          WITH CHECK (
            app_is_admin()
            OR member_profile_id IN (
              SELECT id FROM member_profiles WHERE member_id::text = app_staff_id()
            )
          )$f$,
        t
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE POLICY sla_bot_messages_self ON sla_bot_messages
    USING (
      app_is_admin()
      OR conversation_id IN (
        SELECT id FROM sla_bot_conversations WHERE member_id::text = app_staff_id()
      )
    )
    WITH CHECK (
      app_is_admin()
      OR conversation_id IN (
        SELECT id FROM sla_bot_conversations WHERE member_id::text = app_staff_id()
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE POLICY email_otps_public ON email_otps
    USING (true)
    WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE POLICY app_settings_admin ON app_settings
    USING (app_is_admin())
    WITH CHECK (app_is_admin());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

