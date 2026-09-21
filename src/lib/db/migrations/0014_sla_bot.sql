CREATE TABLE "sla_bot_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sla_bot_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"intent" varchar(40),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sla_bot_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"conversation_id" uuid,
	"kind" varchar(40) NOT NULL,
	"severity" varchar(20) DEFAULT 'info' NOT NULL,
	"summary" varchar(500) NOT NULL,
	"detail" text NOT NULL,
	"email_to" varchar(500),
	"email_sent" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sla_bot_knowledge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" varchar(40) NOT NULL,
	"source_id" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sla_bot_conversations" ADD CONSTRAINT "sla_bot_conversations_member_id_staff_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sla_bot_messages" ADD CONSTRAINT "sla_bot_messages_conversation_id_sla_bot_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."sla_bot_conversations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sla_bot_alerts" ADD CONSTRAINT "sla_bot_alerts_member_id_staff_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sla_bot_alerts" ADD CONSTRAINT "sla_bot_alerts_conversation_id_sla_bot_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."sla_bot_conversations"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_sla_bot_conversations_member" ON "sla_bot_conversations" USING btree ("member_id");
--> statement-breakpoint
CREATE INDEX "idx_sla_bot_messages_conversation" ON "sla_bot_messages" USING btree ("conversation_id","created_at");
--> statement-breakpoint
CREATE INDEX "idx_sla_bot_alerts_created" ON "sla_bot_alerts" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "idx_sla_bot_alerts_resolved" ON "sla_bot_alerts" USING btree ("resolved_at");
--> statement-breakpoint
CREATE INDEX "idx_sla_bot_knowledge_source" ON "sla_bot_knowledge" USING btree ("source_type","source_id");
