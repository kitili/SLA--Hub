CREATE TABLE "clickup_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_token" text,
	"team_id" text,
	"team_name" text,
	"space_id" text,
	"space_name" text,
	"list_id" text,
	"list_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "system_tasks" ADD COLUMN "clickup_task_id" text;--> statement-breakpoint
ALTER TABLE "system_tasks" ADD COLUMN "clickup_assignee_id" text;
