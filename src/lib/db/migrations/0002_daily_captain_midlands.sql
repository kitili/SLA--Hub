ALTER TABLE "member_profiles" ADD COLUMN "consent_given_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "member_profiles" ADD COLUMN "consent_version" text;