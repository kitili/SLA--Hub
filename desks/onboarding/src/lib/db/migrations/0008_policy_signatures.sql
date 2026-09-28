CREATE TABLE "policy_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"item_id" varchar(50) NOT NULL,
	"signed_name" varchar(255) NOT NULL,
	"acknowledged_text" text NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "policy_signatures" ADD CONSTRAINT "policy_signatures_member_id_staff_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "policy_signatures_member_item_unique" ON "policy_signatures" USING btree ("member_id","item_id");
--> statement-breakpoint
CREATE INDEX "idx_policy_signatures_member" ON "policy_signatures" USING btree ("member_id");
