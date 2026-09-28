CREATE TYPE "public"."access_level" AS ENUM('view', 'manage');--> statement-breakpoint
CREATE TYPE "public"."module" AS ENUM('tickets', 'tech_tools', 'systems', 'users', 'departments', 'support_contacts', 'ticket_notifications');--> statement-breakpoint
CREATE TABLE "user_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"module" "module" NOT NULL,
	"level" "access_level" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_modules" ADD CONSTRAINT "user_modules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_modules_user_module_idx" ON "user_modules" USING btree ("user_id","module");