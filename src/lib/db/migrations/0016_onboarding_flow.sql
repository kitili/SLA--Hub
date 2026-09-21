-- Add IT onboarding flow columns to hiring_candidates
ALTER TABLE "hiring_candidates" ADD COLUMN "it_onboarding_token" varchar(64);
--> statement-breakpoint
ALTER TABLE "hiring_candidates" ADD COLUMN "it_onboarding_expires_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "hiring_candidates" ADD COLUMN "work_email" varchar(254);
--> statement-breakpoint
ALTER TABLE "hiring_candidates" ADD COLUMN "it_submitted_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "hiring_candidates" ADD COLUMN "welcome_email_sent_at" timestamptz;
