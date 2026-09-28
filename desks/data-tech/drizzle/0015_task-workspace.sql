ALTER TYPE "task_priority" ADD VALUE IF NOT EXISTS 'urgent';
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "task_recurrence" AS ENUM('none', 'daily', 'weekly', 'monthly');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "system_tasks" ADD COLUMN IF NOT EXISTS "parent_task_id" uuid;
--> statement-breakpoint
ALTER TABLE "system_tasks" ADD COLUMN IF NOT EXISTS "task_number" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "system_tasks" ADD COLUMN IF NOT EXISTS "time_estimate_minutes" integer;
--> statement-breakpoint
ALTER TABLE "system_tasks" ADD COLUMN IF NOT EXISTS "points" integer;
--> statement-breakpoint
ALTER TABLE "system_tasks" ADD COLUMN IF NOT EXISTS "recurrence" "task_recurrence" DEFAULT 'none' NOT NULL;
--> statement-breakpoint
ALTER TABLE "system_tasks" ADD COLUMN IF NOT EXISTS "archived" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "system_tasks" SET "task_number" = numbered.n
FROM (
  SELECT id, row_number() OVER (PARTITION BY system_id ORDER BY created_at) AS n
  FROM "system_tasks"
) AS numbered
WHERE "system_tasks".id = numbered.id;
--> statement-breakpoint
ALTER TABLE "system_tasks" ADD CONSTRAINT "system_tasks_parent_task_id_system_tasks_id_fk" FOREIGN KEY ("parent_task_id") REFERENCES "public"."system_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "system_tasks_number_unique" ON "system_tasks" USING btree ("system_id","task_number");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_task_assignees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_task_watchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_task_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"system_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#7B68EE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_task_tag_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_task_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"title" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_task_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checklist_id" uuid NOT NULL,
	"title" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"assignee_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_task_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"depends_on_task_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_task_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"url" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_task_time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid,
	"minutes" integer NOT NULL,
	"note" text,
	"spent_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_task_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"actor_id" uuid,
	"verb" text NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "system_task_assignees" ADD CONSTRAINT "system_task_assignees_task_id_system_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."system_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "system_task_assignees" ADD CONSTRAINT "system_task_assignees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "system_task_watchers" ADD CONSTRAINT "system_task_watchers_task_id_system_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."system_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "system_task_watchers" ADD CONSTRAINT "system_task_watchers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "system_task_tags" ADD CONSTRAINT "system_task_tags_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "system_task_tag_links" ADD CONSTRAINT "system_task_tag_links_task_id_system_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."system_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "system_task_tag_links" ADD CONSTRAINT "system_task_tag_links_tag_id_system_task_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."system_task_tags"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "system_task_comments" ADD CONSTRAINT "system_task_comments_task_id_system_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."system_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "system_task_comments" ADD CONSTRAINT "system_task_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "system_task_checklists" ADD CONSTRAINT "system_task_checklists_task_id_system_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."system_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "system_task_checklist_items" ADD CONSTRAINT "system_task_checklist_items_checklist_id_system_task_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."system_task_checklists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "system_task_checklist_items" ADD CONSTRAINT "system_task_checklist_items_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "system_task_dependencies" ADD CONSTRAINT "system_task_dependencies_task_id_system_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."system_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "system_task_dependencies" ADD CONSTRAINT "system_task_dependencies_depends_on_task_id_system_tasks_id_fk" FOREIGN KEY ("depends_on_task_id") REFERENCES "public"."system_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "system_task_attachments" ADD CONSTRAINT "system_task_attachments_task_id_system_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."system_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "system_task_time_entries" ADD CONSTRAINT "system_task_time_entries_task_id_system_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."system_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "system_task_time_entries" ADD CONSTRAINT "system_task_time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "system_task_activity" ADD CONSTRAINT "system_task_activity_task_id_system_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."system_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "system_task_activity" ADD CONSTRAINT "system_task_activity_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "system_task_assignees_unique" ON "system_task_assignees" USING btree ("task_id","user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "system_task_watchers_unique" ON "system_task_watchers" USING btree ("task_id","user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "system_task_tags_name_unique" ON "system_task_tags" USING btree ("system_id","name");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "system_task_tag_links_unique" ON "system_task_tag_links" USING btree ("task_id","tag_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "system_task_dependencies_unique" ON "system_task_dependencies" USING btree ("task_id","depends_on_task_id");
--> statement-breakpoint
INSERT INTO "system_task_assignees" ("task_id", "user_id")
SELECT id, assignee_id FROM "system_tasks" WHERE assignee_id IS NOT NULL
ON CONFLICT DO NOTHING;
