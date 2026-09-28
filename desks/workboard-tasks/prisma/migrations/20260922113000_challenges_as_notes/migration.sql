CREATE TYPE "DailyNoteKind" AS ENUM ('PROGRESS', 'CHALLENGE');

ALTER TABLE "ProgressUpdate" ADD COLUMN "kind" "DailyNoteKind" NOT NULL DEFAULT 'PROGRESS';

CREATE INDEX "ProgressUpdate_organizationId_kind_createdAt_idx" ON "ProgressUpdate"("organizationId", "kind", "createdAt");
DROP INDEX IF EXISTS "ProgressUpdate_organizationId_createdAt_idx";

INSERT INTO "ProgressUpdate" ("id", "organizationId", "authorId", "body", "planDate", "createdAt", "kind")
SELECT
  'ch_' || i."id",
  u."organizationId",
  p."userId",
  i."title",
  p."planDate",
  i."createdAt",
  'CHALLENGE'::"DailyNoteKind"
FROM "DailyPlanItem" i
JOIN "DailyPlan" p ON p."id" = i."dailyPlanId"
JOIN "User" u ON u."id" = p."userId"
WHERE i."slot" = 4
  AND NOT EXISTS (
    SELECT 1 FROM "ProgressUpdate" n WHERE n."id" = 'ch_' || i."id"
  );

DELETE FROM "Task"
WHERE "id" IN (
  SELECT "taskId" FROM "DailyPlanItem" WHERE "slot" = 4 AND "taskId" IS NOT NULL
);
