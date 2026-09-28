ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "moveOwnerId" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "sharedWithIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "Task"
SET "moveOwnerId" = COALESCE("authorId", "assigneeId")
WHERE "moveOwnerId" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Task_moveOwnerId_fkey'
  ) THEN
    ALTER TABLE "Task"
      ADD CONSTRAINT "Task_moveOwnerId_fkey"
      FOREIGN KEY ("moveOwnerId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
