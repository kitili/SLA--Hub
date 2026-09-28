CREATE TYPE "public"."section_item_type" AS ENUM('pdf', 'docx', 'video', 'image', 'pptx', 'link');--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"quiz_id" varchar(100) NOT NULL,
	"score" integer NOT NULL,
	"passed" boolean NOT NULL,
	"answers" jsonb,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_children" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_profile_id" uuid NOT NULL,
	"full_names" varchar(255),
	"date_of_birth" date,
	"gender" varchar(50),
	"school_employer" varchar(255),
	"contact_number" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "member_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_profile_id" uuid NOT NULL,
	"document_type" varchar(100),
	"file_path" varchar(500),
	"original_name" varchar(255),
	"mime_type" varchar(100),
	"file_size_bytes" integer,
	"uploaded_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "member_emergency_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_profile_id" uuid NOT NULL,
	"full_name" varchar(255),
	"relationship" varchar(100),
	"phone" varchar(50),
	"address" text,
	"priority" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "member_employment_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_profile_id" uuid NOT NULL,
	"employer" varchar(255),
	"position" varchar(150),
	"date_from" date,
	"date_to" date,
	"leaving_reason" text
);
--> statement-breakpoint
CREATE TABLE "member_family_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_profile_id" uuid NOT NULL,
	"relationship" varchar(50),
	"full_name" varchar(255),
	"phone" varchar(50),
	"address" text,
	"occupation" varchar(150)
);
--> statement-breakpoint
CREATE TABLE "member_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"surname" varchar(100),
	"first_name" varchar(100),
	"middle_name" varchar(100),
	"other_names" varchar(255),
	"maiden_name" varchar(100),
	"gender" varchar(50),
	"marital_status" varchar(50),
	"date_of_birth" date,
	"place_of_birth" varchar(150),
	"nationality" varchar(100),
	"has_disabilities" boolean,
	"disabilities_details" text,
	"home_phone" varchar(50),
	"mobile_phone" varchar(50),
	"email" varchar(255),
	"residential_address" text,
	"identification_no" varchar(50),
	"id_place_of_issue" varchar(150),
	"id_expiry_date" date,
	"driving_permit_no" varchar(50),
	"driving_place_of_issue" varchar(150),
	"driving_expiry_date" date,
	"nssf_no" varchar(50),
	"tin_no" varchar(50),
	"nhif_no" varchar(50),
	"position" varchar(150),
	"work_station" varchar(150),
	"bank_name" varchar(100),
	"account_name" varchar(255),
	"account_number" varchar(50),
	"mobile_money_number" varchar(50),
	"arrest_record" boolean,
	"arrest_details" text,
	"misconduct_record" boolean,
	"misconduct_details" text,
	"certification_name" varchar(255),
	"certification_date" date,
	"submitted_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "member_profiles_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
CREATE TABLE "member_qualifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_profile_id" uuid NOT NULL,
	"level" varchar(100),
	"qualification" varchar(255),
	"institution" varchar(255),
	"year_obtained" integer
);
--> statement-breakpoint
CREATE TABLE "member_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_profile_id" uuid NOT NULL,
	"reference_order" integer,
	"full_name" varchar(255),
	"relationship" varchar(100),
	"phone" varchar(50),
	"email" varchar(255),
	"organization" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "member_relatives_employed" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_profile_id" uuid NOT NULL,
	"full_name" varchar(255),
	"relationship" varchar(100),
	"position" varchar(150),
	"work_station" varchar(150)
);
--> statement-breakpoint
CREATE TABLE "member_spouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_profile_id" uuid NOT NULL,
	"full_name" varchar(255),
	"phone" varchar(50),
	"occupation" varchar(150),
	"employer" varchar(255),
	CONSTRAINT "member_spouses_member_profile_id_unique" UNIQUE("member_profile_id")
);
--> statement-breakpoint
CREATE TABLE "section_items" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"section_id" varchar(100) NOT NULL,
	"order" integer NOT NULL,
	"type" "section_item_type" DEFAULT 'pdf' NOT NULL,
	"title_en" varchar(255) NOT NULL,
	"title_sw" varchar(255),
	"note_en" text,
	"note_sw" text
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	"order" integer NOT NULL,
	"icon" varchar(32),
	"title_en" varchar(255) NOT NULL,
	"title_sw" varchar(255),
	"description_en" text,
	"description_sw" text,
	"is_published" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"text_en" text NOT NULL,
	"text_sw" text,
	"is_correct" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" varchar(100) NOT NULL,
	"order" integer NOT NULL,
	"text_en" text NOT NULL,
	"text_sw" text
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"section_id" varchar(100) NOT NULL,
	"pass_threshold" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "quizzes_section_id_unique" UNIQUE("section_id")
);
--> statement-breakpoint
CREATE TABLE "content_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"effective_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signoffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"content_version_id" uuid NOT NULL,
	"acknowledged_text" text NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_role_visibility" (
	"section_item_id" varchar(50) NOT NULL,
	"role_id" varchar(50) NOT NULL,
	CONSTRAINT "item_role_visibility_section_item_id_role_id_pk" PRIMARY KEY("section_item_id","role_id")
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
ALTER TABLE "staff" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "section_item_id" varchar(50);--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_member_id_staff_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_children" ADD CONSTRAINT "member_children_member_profile_id_member_profiles_id_fk" FOREIGN KEY ("member_profile_id") REFERENCES "public"."member_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_documents" ADD CONSTRAINT "member_documents_member_profile_id_member_profiles_id_fk" FOREIGN KEY ("member_profile_id") REFERENCES "public"."member_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_emergency_contacts" ADD CONSTRAINT "member_emergency_contacts_member_profile_id_member_profiles_id_fk" FOREIGN KEY ("member_profile_id") REFERENCES "public"."member_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_employment_history" ADD CONSTRAINT "member_employment_history_member_profile_id_member_profiles_id_fk" FOREIGN KEY ("member_profile_id") REFERENCES "public"."member_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_family_contacts" ADD CONSTRAINT "member_family_contacts_member_profile_id_member_profiles_id_fk" FOREIGN KEY ("member_profile_id") REFERENCES "public"."member_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_profiles" ADD CONSTRAINT "member_profiles_member_id_staff_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_qualifications" ADD CONSTRAINT "member_qualifications_member_profile_id_member_profiles_id_fk" FOREIGN KEY ("member_profile_id") REFERENCES "public"."member_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_references" ADD CONSTRAINT "member_references_member_profile_id_member_profiles_id_fk" FOREIGN KEY ("member_profile_id") REFERENCES "public"."member_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_relatives_employed" ADD CONSTRAINT "member_relatives_employed_member_profile_id_member_profiles_id_fk" FOREIGN KEY ("member_profile_id") REFERENCES "public"."member_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_spouses" ADD CONSTRAINT "member_spouses_member_profile_id_member_profiles_id_fk" FOREIGN KEY ("member_profile_id") REFERENCES "public"."member_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_items" ADD CONSTRAINT "section_items_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_options" ADD CONSTRAINT "quiz_options_question_id_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signoffs" ADD CONSTRAINT "signoffs_member_id_staff_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signoffs" ADD CONSTRAINT "signoffs_content_version_id_content_versions_id_fk" FOREIGN KEY ("content_version_id") REFERENCES "public"."content_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_role_visibility" ADD CONSTRAINT "item_role_visibility_section_item_id_section_items_id_fk" FOREIGN KEY ("section_item_id") REFERENCES "public"."section_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_role_visibility" ADD CONSTRAINT "item_role_visibility_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_roles" ADD CONSTRAINT "member_roles_member_id_staff_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_roles" ADD CONSTRAINT "member_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_quiz_attempts_member" ON "quiz_attempts" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_quiz_attempts_quiz" ON "quiz_attempts" USING btree ("quiz_id");--> statement-breakpoint
CREATE INDEX "idx_member_children_profile" ON "member_children" USING btree ("member_profile_id");--> statement-breakpoint
CREATE INDEX "idx_member_documents_profile" ON "member_documents" USING btree ("member_profile_id");--> statement-breakpoint
CREATE INDEX "idx_member_emergency_contacts_profile" ON "member_emergency_contacts" USING btree ("member_profile_id");--> statement-breakpoint
CREATE INDEX "idx_member_employment_history_profile" ON "member_employment_history" USING btree ("member_profile_id");--> statement-breakpoint
CREATE INDEX "idx_member_family_contacts_profile" ON "member_family_contacts" USING btree ("member_profile_id");--> statement-breakpoint
CREATE INDEX "idx_member_profiles_member" ON "member_profiles" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_member_qualifications_profile" ON "member_qualifications" USING btree ("member_profile_id");--> statement-breakpoint
CREATE INDEX "idx_member_references_profile" ON "member_references" USING btree ("member_profile_id");--> statement-breakpoint
CREATE INDEX "idx_member_relatives_employed_profile" ON "member_relatives_employed" USING btree ("member_profile_id");--> statement-breakpoint
CREATE INDEX "idx_section_items_section" ON "section_items" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "idx_sections_order" ON "sections" USING btree ("order");--> statement-breakpoint
CREATE INDEX "idx_quiz_options_question" ON "quiz_options" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "idx_quiz_questions_quiz" ON "quiz_questions" USING btree ("quiz_id");--> statement-breakpoint
CREATE INDEX "idx_signoffs_member" ON "signoffs" USING btree ("member_id");--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_section_item_id_section_items_id_fk" FOREIGN KEY ("section_item_id") REFERENCES "public"."section_items"("id") ON DELETE set null ON UPDATE no action;