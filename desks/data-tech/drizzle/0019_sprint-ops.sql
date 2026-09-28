ALTER TABLE "systems" ADD COLUMN IF NOT EXISTS "wip_in_progress" integer DEFAULT 3;
--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN IF NOT EXISTS "wip_review" integer DEFAULT 3;
--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN IF NOT EXISTS "default_capacity_points" integer DEFAULT 8;
--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN IF NOT EXISTS "default_capacity_minutes" integer;
--> statement-breakpoint
ALTER TABLE "system_sprints" ADD COLUMN IF NOT EXISTS "review_notes" text;
--> statement-breakpoint
ALTER TABLE "system_sprints" ADD COLUMN IF NOT EXISTS "retro_went_well" text;
--> statement-breakpoint
ALTER TABLE "system_sprints" ADD COLUMN IF NOT EXISTS "retro_improve" text;
--> statement-breakpoint
ALTER TABLE "system_sprints" ADD COLUMN IF NOT EXISTS "retro_actions" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sprint_capacities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"minutes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sprint_capacities" ADD CONSTRAINT "sprint_capacities_sprint_id_system_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."system_sprints"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sprint_capacities" ADD CONSTRAINT "sprint_capacities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sprint_capacities_sprint_user_idx" ON "sprint_capacities" USING btree ("sprint_id","user_id");
