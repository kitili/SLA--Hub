CREATE TYPE "public"."project_state" AS ENUM('open', 'closed');--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN "lead_id" uuid;--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN "state" "project_state" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "systems" ADD COLUMN "target_date" date;--> statement-breakpoint
ALTER TABLE "system_tasks" ADD COLUMN "completion_percentage" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "system_tasks" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "systems" ADD CONSTRAINT "systems_lead_id_users_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;