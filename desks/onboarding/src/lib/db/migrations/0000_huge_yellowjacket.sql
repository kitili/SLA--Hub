CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"campus" varchar(100),
	"job_title" varchar(150),
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "checkpoint_completions" (
	"staff_id" uuid NOT NULL,
	"checkpoint_id" varchar(50) NOT NULL,
	"passed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkpoint_completions_staff_id_checkpoint_id_pk" PRIMARY KEY("staff_id","checkpoint_id")
);
--> statement-breakpoint
CREATE TABLE "document_reads" (
	"staff_id" uuid NOT NULL,
	"item_id" varchar(50) NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_reads_staff_id_item_id_pk" PRIMARY KEY("staff_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_item_id" varchar(50),
	"language" varchar(16),
	"filename" varchar(255) NOT NULL,
	"content_type" varchar(127) NOT NULL,
	"size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checkpoint_completions" ADD CONSTRAINT "checkpoint_completions_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_reads" ADD CONSTRAINT "document_reads_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_staff_email" ON "staff" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_checkpoint_staff" ON "checkpoint_completions" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "idx_reads_staff" ON "document_reads" USING btree ("staff_id");