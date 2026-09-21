ALTER TABLE "sla_bot_conversations" ADD COLUMN "audience" varchar(20) DEFAULT 'learner' NOT NULL;
--> statement-breakpoint
ALTER TABLE "sla_bot_knowledge" ADD COLUMN "audience" varchar(20) DEFAULT 'learner' NOT NULL;
--> statement-breakpoint
CREATE INDEX "idx_sla_bot_conversations_audience" ON "sla_bot_conversations" USING btree ("member_id","audience");
--> statement-breakpoint
CREATE INDEX "idx_sla_bot_knowledge_audience" ON "sla_bot_knowledge" USING btree ("audience");
