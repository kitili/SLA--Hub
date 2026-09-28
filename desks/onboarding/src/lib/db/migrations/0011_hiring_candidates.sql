CREATE TABLE "hiring_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"email" varchar(254) NOT NULL,
	"preferred_email" varchar(254),
	"linkedin" text,
	"cv_link" text,
	"role_applied" varchar(255) DEFAULT 'General' NOT NULL,
	"application_check" varchar(64) DEFAULT 'OK' NOT NULL,
	"stage" varchar(64) DEFAULT 'new' NOT NULL,
	"culture_marker" varchar(8),
	"culture_video_link" text,
	"culture_video_feedback" text,
	"culture_token" varchar(64),
	"performance_marker" varchar(8),
	"performance_task_sent_at" timestamp with time zone,
	"performance_task_link" text,
	"performance_task_submitted" text,
	"performance_token" varchar(64),
	"notes" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_hiring_candidates_culture_token" ON "hiring_candidates" USING btree ("culture_token") WHERE "culture_token" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_hiring_candidates_performance_token" ON "hiring_candidates" USING btree ("performance_token") WHERE "performance_token" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "idx_hiring_candidates_stage" ON "hiring_candidates" USING btree ("stage");
--> statement-breakpoint
CREATE INDEX "idx_hiring_candidates_created_at" ON "hiring_candidates" USING btree ("created_at" DESC);
--> statement-breakpoint
CREATE INDEX "idx_hiring_candidates_email" ON "hiring_candidates" USING btree ("email");
--> statement-breakpoint
CREATE TABLE "hiring_pipeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"action" varchar(32) NOT NULL,
	"actor_id" uuid,
	"detail" text,
	"email_to" varchar(254),
	"email_subject" varchar(500),
	"success" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hiring_pipeline_events" ADD CONSTRAINT "hiring_pipeline_events_candidate_id_hiring_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."hiring_candidates"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_hiring_pipeline_events_candidate" ON "hiring_pipeline_events" USING btree ("candidate_id","created_at" DESC);
