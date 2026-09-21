CREATE TABLE "app_settings" (
  "key" varchar(128) PRIMARY KEY,
  "value" text NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
-- Seed with the default IT email (can be changed via admin panel)
INSERT INTO "app_settings" ("key", "value") VALUES ('it_email', 'it@silverleaf.co.tz');
