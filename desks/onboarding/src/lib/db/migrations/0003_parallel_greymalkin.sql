CREATE TABLE "campuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campuses_name_unique" UNIQUE("name")
);
--> statement-breakpoint

-- Seed the five Silverleaf Academy campuses
INSERT INTO "campuses" ("name") VALUES
  ('Usa River'),
  ('Arusha Modern'),
  ('Kijenge'),
  ('Boma'),
  ('Ilboru')
ON CONFLICT ("name") DO NOTHING;
