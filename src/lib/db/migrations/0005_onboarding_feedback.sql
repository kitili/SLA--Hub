CREATE TABLE "onboarding_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"expectations" text,
	"unclear" text,
	"improvements" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_feedback_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
ALTER TABLE "onboarding_feedback" ADD CONSTRAINT "onboarding_feedback_member_id_staff_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_onboarding_feedback_member" ON "onboarding_feedback" USING btree ("member_id");
