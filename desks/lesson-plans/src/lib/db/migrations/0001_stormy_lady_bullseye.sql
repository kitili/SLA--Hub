CREATE TABLE "schemes_of_work" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"grade" text NOT NULL,
	"grade_num" integer NOT NULL,
	"subject" text NOT NULL,
	"term" text NOT NULL,
	"term_ordinal" integer NOT NULL,
	"year" text,
	"header_context" jsonb,
	"source_filename" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sow_lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheme_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"week" integer,
	"lesson_number" text,
	"specific_competence" text,
	"main_activity" text,
	"lesson_objective" text,
	"knowledge_and_skills" text,
	"assessment_evidence" text,
	"learning_activities" text,
	"misconceptions" text,
	"differentiation_support" text,
	"resources" text,
	"reflection" text,
	"source" text DEFAULT 'parsed' NOT NULL,
	"raw_cells" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "textbooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"subject" text,
	"grade" text,
	"grade_num" integer,
	"publisher" text,
	"page_count" integer,
	"file_key" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"pages_processed" integer DEFAULT 0 NOT NULL,
	"ocr_model" text,
	"error" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "textbook_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"textbook_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"chapter" text,
	"heading" text,
	"content" text DEFAULT '' NOT NULL,
	"keywords" jsonb,
	"image_key" text,
	"thumb_key" text,
	"ocr_model" text,
	"ocr_at" timestamp with time zone,
	"source" text DEFAULT 'ocr' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"content" text NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prompt_parts_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "lesson_plans" ADD COLUMN "scheme_lesson_id" uuid;--> statement-breakpoint
ALTER TABLE "lesson_plans" ADD COLUMN "textbook_id" uuid;--> statement-breakpoint
ALTER TABLE "lesson_plans" ADD COLUMN "textbook_page_ids" jsonb;--> statement-breakpoint
ALTER TABLE "lesson_plans" ADD COLUMN "model_id" text;--> statement-breakpoint
ALTER TABLE "schemes_of_work" ADD CONSTRAINT "schemes_of_work_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sow_lessons" ADD CONSTRAINT "sow_lessons_scheme_id_schemes_of_work_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."schemes_of_work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "textbooks" ADD CONSTRAINT "textbooks_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "textbook_pages" ADD CONSTRAINT "textbook_pages_textbook_id_textbooks_id_fk" FOREIGN KEY ("textbook_id") REFERENCES "public"."textbooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_parts" ADD CONSTRAINT "prompt_parts_updated_by_staff_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "schemes_of_work_grade_subject_term_idx" ON "schemes_of_work" USING btree ("grade_num","subject","term_ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "sow_lessons_scheme_order_idx" ON "sow_lessons" USING btree ("scheme_id","order_index");--> statement-breakpoint
CREATE INDEX "sow_lessons_scheme_week_idx" ON "sow_lessons" USING btree ("scheme_id","week");--> statement-breakpoint
CREATE INDEX "textbooks_grade_subject_idx" ON "textbooks" USING btree ("grade_num","subject");--> statement-breakpoint
CREATE UNIQUE INDEX "textbook_pages_book_page_idx" ON "textbook_pages" USING btree ("textbook_id","page_number");--> statement-breakpoint
CREATE INDEX "textbook_pages_book_chapter_idx" ON "textbook_pages" USING btree ("textbook_id","chapter");--> statement-breakpoint
CREATE INDEX "textbook_pages_fts_idx" ON "textbook_pages" USING gin (to_tsvector('simple', coalesce("heading", '') || ' ' || "content"));--> statement-breakpoint
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_scheme_lesson_id_sow_lessons_id_fk" FOREIGN KEY ("scheme_lesson_id") REFERENCES "public"."sow_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_textbook_id_textbooks_id_fk" FOREIGN KEY ("textbook_id") REFERENCES "public"."textbooks"("id") ON DELETE no action ON UPDATE no action;