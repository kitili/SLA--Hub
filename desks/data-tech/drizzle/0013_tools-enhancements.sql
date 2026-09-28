CREATE TABLE "tool_reminder_dates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"label" text NOT NULL,
	"date" date NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_reminders_sent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reminder_date_id" uuid NOT NULL,
	"date" date NOT NULL,
	"offset_days" integer NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "tool_id" uuid;--> statement-breakpoint
ALTER TABLE "tool_categories" ADD COLUMN "useful_life_years" integer;--> statement-breakpoint
ALTER TABLE "tool_reminder_dates" ADD CONSTRAINT "tool_reminder_dates_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_reminders_sent" ADD CONSTRAINT "tool_reminders_sent_reminder_date_id_tool_reminder_dates_id_fk" FOREIGN KEY ("reminder_date_id") REFERENCES "public"."tool_reminder_dates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tool_reminders_sent_unique_idx" ON "tool_reminders_sent" USING btree ("reminder_date_id","date","offset_days");--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;