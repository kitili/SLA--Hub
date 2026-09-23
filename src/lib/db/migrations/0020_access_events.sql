CREATE TABLE IF NOT EXISTS "access_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "staff_id" uuid NOT NULL REFERENCES "staff"("id") ON DELETE CASCADE,
  "email" varchar(255) NOT NULL,
  "full_name" varchar(255) NOT NULL,
  "action" varchar(32) NOT NULL,
  "department_id" varchar(64),
  "department_name" varchar(120),
  "path" varchar(255),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_access_events_created_at" ON "access_events" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_access_events_staff_created" ON "access_events" ("staff_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_access_events_action" ON "access_events" ("action");
--> statement-breakpoint
DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.access_events ENABLE ROW LEVEL SECURITY';
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE POLICY access_events_select ON access_events
    FOR SELECT
    USING (app_is_admin() OR staff_id::text = app_staff_id());
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_function THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE POLICY access_events_insert ON access_events
    FOR INSERT
    WITH CHECK (app_is_admin() OR staff_id::text = app_staff_id());
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_function THEN NULL;
END $$;
