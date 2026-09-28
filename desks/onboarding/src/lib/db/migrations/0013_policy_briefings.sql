CREATE TABLE "policy_briefings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_item_id" varchar(50) NOT NULL,
	"source_material_id" uuid,
	"source_filename" varchar(255),
	"source_hash" varchar(64),
	"status" varchar(20) DEFAULT 'generating' NOT NULL,
	"generator" varchar(20),
	"error_message" text,
	"script_en" jsonb DEFAULT '{"title":"","intro":"","chapters":[],"close":"","nextStep":""}'::jsonb NOT NULL,
	"script_sw" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "policy_briefings" ADD CONSTRAINT "policy_briefings_section_item_id_section_items_id_fk" FOREIGN KEY ("section_item_id") REFERENCES "public"."section_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "policy_briefings" ADD CONSTRAINT "policy_briefings_source_material_id_materials_id_fk" FOREIGN KEY ("source_material_id") REFERENCES "public"."materials"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "policy_briefings" ADD CONSTRAINT "policy_briefings_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_policy_briefings_item" ON "policy_briefings" USING btree ("section_item_id");
--> statement-breakpoint
CREATE INDEX "idx_policy_briefings_item_status" ON "policy_briefings" USING btree ("section_item_id","status");
