DO $$ BEGIN
  ALTER TYPE "module" ADD VALUE 'one_to_fives';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."one_to_five_status" AS ENUM('on_time', 'late', 'missed', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."one_to_five_progress" AS ENUM('not_started', 'in_progress', 'completed', 'abandoned');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "one_to_fives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"slot_1" text,
	"slot_2" text,
	"slot_3" text,
	"blockers" text,
	"notes" text,
	"prior_slot_1_progress" "one_to_five_progress",
	"prior_slot_2_progress" "one_to_five_progress",
	"prior_slot_3_progress" "one_to_five_progress",
	"submitted_at" timestamp with time zone,
	"status" "one_to_five_status" DEFAULT 'on_time' NOT NULL,
	"skip_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "one_to_five_holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"holiday_date" date NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "one_to_five_extra_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_date" date NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pulse_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid NOT NULL,
	"week_thursday" date NOT NULL,
	"wins" text,
	"risks" text,
	"help_needed" text,
	"submitted_by" uuid,
	"submitted_at" timestamp with time zone,
	"status" "one_to_five_status" DEFAULT 'on_time' NOT NULL,
	"skip_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "one_to_fives" ADD CONSTRAINT "one_to_fives_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pulse_checks" ADD CONSTRAINT "pulse_checks_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pulse_checks" ADD CONSTRAINT "pulse_checks_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "one_to_fives_user_date_idx" ON "one_to_fives" USING btree ("user_id","work_date");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "one_to_five_holidays_date_idx" ON "one_to_five_holidays" USING btree ("holiday_date");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "one_to_five_extra_days_date_idx" ON "one_to_five_extra_days" USING btree ("work_date");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pulse_checks_dept_week_idx" ON "pulse_checks" USING btree ("department_id","week_thursday");
