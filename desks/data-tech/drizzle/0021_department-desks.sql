ALTER TABLE "systems" ADD COLUMN IF NOT EXISTS "department_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "systems" ADD CONSTRAINT "systems_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "one_to_fives" ADD COLUMN IF NOT EXISTS "slot_1_progress" "one_to_five_progress";
--> statement-breakpoint
ALTER TABLE "one_to_fives" ADD COLUMN IF NOT EXISTS "slot_2_progress" "one_to_five_progress";
--> statement-breakpoint
ALTER TABLE "one_to_fives" ADD COLUMN IF NOT EXISTS "slot_3_progress" "one_to_five_progress";
--> statement-breakpoint
ALTER TABLE "one_to_fives" ADD COLUMN IF NOT EXISTS "closed_at" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "one_to_five_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"one_to_five_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "one_to_five_feedback" ADD CONSTRAINT "one_to_five_feedback_one_to_five_id_one_to_fives_id_fk" FOREIGN KEY ("one_to_five_id") REFERENCES "public"."one_to_fives"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "one_to_five_feedback" ADD CONSTRAINT "one_to_five_feedback_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "one_to_five_feedback_entry_idx" ON "one_to_five_feedback" USING btree ("one_to_five_id");
