DO $$ BEGIN
  CREATE TYPE "ticket_category" AS ENUM('hardware', 'software', 'network', 'access', 'facilities', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "ticket_source" AS ENUM('public', 'internal');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "submitter_name" text;
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "category" "ticket_category" DEFAULT 'other' NOT NULL;
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "source" "ticket_source" DEFAULT 'public' NOT NULL;
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "due_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "linked_task_id" uuid;
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_linked_task_id_system_tasks_id_fk" FOREIGN KEY ("linked_task_id") REFERENCES "public"."system_tasks"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION tickets_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector(
    'english',
    coalesce(NEW.issue, '') || ' ' ||
    coalesce(NEW.ticket_number, '') || ' ' ||
    coalesce(NEW.submitter_name, '') || ' ' ||
    coalesce(NEW.submitter_email, '') || ' ' ||
    coalesce(NEW.place_of_work, '')
  );
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
