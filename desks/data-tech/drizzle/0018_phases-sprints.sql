DO $$ BEGIN
  CREATE TYPE "sprint_status" AS ENUM('planned', 'active', 'completed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"system_id" uuid NOT NULL,
	"name" text NOT NULL,
	"goal" text,
	"position" integer DEFAULT 0 NOT NULL,
	"start_date" date,
	"target_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_sprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"system_id" uuid NOT NULL,
	"phase_id" uuid,
	"number" integer NOT NULL,
	"name" text NOT NULL,
	"goal" text,
	"status" "sprint_status" DEFAULT 'planned' NOT NULL,
	"start_date" date,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "system_tasks" ADD COLUMN IF NOT EXISTS "phase_id" uuid;
--> statement-breakpoint
ALTER TABLE "system_tasks" ADD COLUMN IF NOT EXISTS "sprint_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "system_phases" ADD CONSTRAINT "system_phases_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "system_sprints" ADD CONSTRAINT "system_sprints_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "system_sprints" ADD CONSTRAINT "system_sprints_phase_id_system_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."system_phases"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "system_tasks" ADD CONSTRAINT "system_tasks_phase_id_system_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."system_phases"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "system_tasks" ADD CONSTRAINT "system_tasks_sprint_id_system_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."system_sprints"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "system_sprints_number_unique" ON "system_sprints" USING btree ("system_id","number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "system_phases_system_idx" ON "system_phases" USING btree ("system_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "system_sprints_system_idx" ON "system_sprints" USING btree ("system_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "system_tasks_sprint_idx" ON "system_tasks" USING btree ("sprint_id");
