CREATE TABLE "hiring_performance_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"file_link" text,
	"manager_email" varchar(254),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hiring_candidates" ADD COLUMN "performance_task_id" uuid;
--> statement-breakpoint
ALTER TABLE "hiring_candidates" ADD COLUMN "performance_manager_email" varchar(254);
--> statement-breakpoint
ALTER TABLE "hiring_candidates" ADD CONSTRAINT "hiring_candidates_performance_task_id_hiring_performance_tasks_id_fk" FOREIGN KEY ("performance_task_id") REFERENCES "public"."hiring_performance_tasks"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_hiring_performance_tasks_active" ON "hiring_performance_tasks" USING btree ("is_active");
