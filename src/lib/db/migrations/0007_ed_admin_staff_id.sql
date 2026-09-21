ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "ed_admin_staff_id" varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "staff_ed_admin_staff_id_unique" ON "staff" ("ed_admin_staff_id") WHERE "ed_admin_staff_id" IS NOT NULL;
