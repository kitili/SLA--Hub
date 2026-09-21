CREATE TABLE "section_declarations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"section_id" varchar(50) NOT NULL,
	"acknowledged_text" text NOT NULL,
	"declared_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "section_declarations" ADD CONSTRAINT "section_declarations_member_id_staff_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_section_declarations_member" ON "section_declarations" USING btree ("member_id");
--> statement-breakpoint
CREATE INDEX "idx_section_declarations_member_section" ON "section_declarations" USING btree ("member_id","section_id");
