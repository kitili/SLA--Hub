CREATE TYPE "public"."tool_category_icon" AS ENUM('phone', 'tablet', 'laptop', 'desktop', 'projector', 'camera', 'printer', 'other');--> statement-breakpoint
ALTER TABLE "tool_categories" ADD COLUMN "icon" "tool_category_icon" DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "brand" text;--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "specifications" text;--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "purchase_price" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "tool_allocations" ADD COLUMN "expected_return_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tool_allocations" ADD COLUMN "purpose" text;