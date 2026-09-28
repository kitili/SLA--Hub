CREATE TABLE "ai_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requested_by" uuid NOT NULL,
	"mode" text NOT NULL,
	"model_id" text NOT NULL,
	"input_params" jsonb NOT NULL,
	"status" text NOT NULL,
	"workflow_run_id" text,
	"result_plan_ids" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"campus" varchar(100),
	"job_title" varchar(150),
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	CONSTRAINT "staff_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "item_role_visibility" (
	"plan_id" uuid NOT NULL,
	"role_id" varchar(50) NOT NULL,
	CONSTRAINT "item_role_visibility_plan_id_role_id_pk" PRIMARY KEY("plan_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "member_roles" (
	"member_id" uuid NOT NULL,
	"role_id" varchar(50) NOT NULL,
	CONSTRAINT "member_roles_member_id_role_id_pk" PRIMARY KEY("member_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name_en" varchar(150) NOT NULL,
	"name_sw" varchar(150)
);
--> statement-breakpoint
CREATE TABLE "lesson_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"filename" text NOT NULL,
	"grade" text NOT NULL,
	"grade_num" integer NOT NULL,
	"subject" text NOT NULL,
	"term" text NOT NULL,
	"term_ordinal" integer NOT NULL,
	"week" integer NOT NULL,
	"lesson" integer NOT NULL,
	"title" text NOT NULL,
	"topic" text,
	"objectives" jsonb,
	"duration_minutes" integer,
	"content_markdown" text NOT NULL,
	"content_json" jsonb,
	"status" text DEFAULT 'published' NOT NULL,
	"source" text DEFAULT 'import' NOT NULL,
	"blob_url" text,
	"search_text" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "plan_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_streak" (
	"staff_id" uuid PRIMARY KEY NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_feedback_date" date
);
--> statement-breakpoint
CREATE TABLE "points_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"points" integer NOT NULL,
	"reason" text NOT NULL,
	"plan_id" uuid,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_misses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"query" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "item_role_visibility" ADD CONSTRAINT "item_role_visibility_plan_id_lesson_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."lesson_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_role_visibility" ADD CONSTRAINT "item_role_visibility_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_roles" ADD CONSTRAINT "member_roles_member_id_staff_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_roles" ADD CONSTRAINT "member_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_usage_events" ADD CONSTRAINT "plan_usage_events_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_usage_events" ADD CONSTRAINT "plan_usage_events_plan_id_lesson_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."lesson_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_feedback" ADD CONSTRAINT "plan_feedback_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_feedback" ADD CONSTRAINT "plan_feedback_plan_id_lesson_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."lesson_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_streak" ADD CONSTRAINT "feedback_streak_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_staff_email" ON "staff" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_plans_slug_idx" ON "lesson_plans" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "lesson_plans_grade_subject_term_week_lesson_idx" ON "lesson_plans" USING btree ("grade_num","subject","term_ordinal","week","lesson");--> statement-breakpoint
CREATE INDEX "lesson_plans_subject_idx" ON "lesson_plans" USING btree ("subject");--> statement-breakpoint
CREATE INDEX "lesson_plans_grade_idx" ON "lesson_plans" USING btree ("grade");--> statement-breakpoint
CREATE INDEX "lesson_plans_term_idx" ON "lesson_plans" USING btree ("term");--> statement-breakpoint
CREATE INDEX "lesson_plans_fts_idx" ON "lesson_plans" USING gin (to_tsvector('simple', "search_text"));--> statement-breakpoint
CREATE INDEX "plan_usage_events_staff_occurred_idx" ON "plan_usage_events" USING btree ("staff_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "plan_usage_events_plan_occurred_idx" ON "plan_usage_events" USING btree ("plan_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_feedback_staff_plan_idx" ON "plan_feedback" USING btree ("staff_id","plan_id");--> statement-breakpoint
CREATE INDEX "plan_feedback_plan_idx" ON "plan_feedback" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plan_feedback_rating_idx" ON "plan_feedback" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "points_ledger_staff_awarded_idx" ON "points_ledger" USING btree ("staff_id","awarded_at");--> statement-breakpoint
CREATE INDEX "search_misses_occurred_at_idx" ON "search_misses" USING btree ("occurred_at");