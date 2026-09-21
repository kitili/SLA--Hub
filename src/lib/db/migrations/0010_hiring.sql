CREATE TABLE "job_openings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"role_track" varchar(50) NOT NULL,
	"campus" varchar(150),
	"description" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "job_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_opening_id" uuid NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"email" varchar(254) NOT NULL,
	"phone" varchar(50),
	"stage" varchar(30) DEFAULT 'applied' NOT NULL,
	"internal_notes" text,
	"ed_admin_staff_id" varchar(64),
	"hired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_created_by_id_staff_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_job_opening_id_job_openings_id_fk" FOREIGN KEY ("job_opening_id") REFERENCES "public"."job_openings"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_job_openings_status" ON "job_openings" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "idx_job_openings_role_track" ON "job_openings" USING btree ("role_track");
--> statement-breakpoint
CREATE INDEX "idx_job_applications_job" ON "job_applications" USING btree ("job_opening_id");
--> statement-breakpoint
CREATE INDEX "idx_job_applications_stage" ON "job_applications" USING btree ("stage");
--> statement-breakpoint
CREATE INDEX "idx_job_applications_email" ON "job_applications" USING btree ("email");
