DO $$ BEGIN
  CREATE TYPE "ticket_impact" AS ENUM('individual', 'classroom', 'campus');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "impact" "ticket_impact" DEFAULT 'individual' NOT NULL;
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "campus" text;
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "internal_notes" text;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION tickets_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector(
    'english',
    coalesce(NEW.issue, '') || ' ' ||
    coalesce(NEW.ticket_number, '') || ' ' ||
    coalesce(NEW.submitter_name, '') || ' ' ||
    coalesce(NEW.submitter_email, '') || ' ' ||
    coalesce(NEW.place_of_work, '') || ' ' ||
    coalesce(NEW.campus, '')
  );
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS tickets_search_vector_trigger ON tickets;
--> statement-breakpoint
CREATE TRIGGER tickets_search_vector_trigger
BEFORE INSERT OR UPDATE OF issue, ticket_number, submitter_name, submitter_email, place_of_work, campus ON tickets
FOR EACH ROW EXECUTE FUNCTION tickets_search_vector_update();
