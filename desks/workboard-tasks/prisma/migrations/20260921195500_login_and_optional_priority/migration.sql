ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "authorId" TEXT;
ALTER TABLE "Task" ALTER COLUMN "priority" DROP NOT NULL;
ALTER TABLE "Task" ALTER COLUMN "priority" DROP DEFAULT;

UPDATE "User"
SET "username" = lower(regexp_replace("name", '[^a-zA-Z0-9]+', '', 'g'))
WHERE "username" IS NULL AND "name" IS NOT NULL;

ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_authorId_fkey";
ALTER TABLE "Task"
  ADD CONSTRAINT "Task_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Task_authorId_idx" ON "Task"("authorId");
CREATE INDEX IF NOT EXISTS "User_username_idx" ON "User"("username");
