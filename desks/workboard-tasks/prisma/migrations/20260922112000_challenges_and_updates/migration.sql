CREATE TABLE "ProgressUpdate" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "planDate" DATE NOT NULL,
  "readByIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgressUpdate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProgressUpdate_organizationId_createdAt_idx" ON "ProgressUpdate"("organizationId", "createdAt");
CREATE INDEX "ProgressUpdate_authorId_createdAt_idx" ON "ProgressUpdate"("authorId", "createdAt");

ALTER TABLE "ProgressUpdate" ADD CONSTRAINT "ProgressUpdate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgressUpdate" ADD CONSTRAINT "ProgressUpdate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ProgressUpdate" ("id", "organizationId", "authorId", "body", "planDate", "createdAt")
SELECT
  'pu_' || i."id",
  u."organizationId",
  p."userId",
  i."title",
  p."planDate",
  i."createdAt"
FROM "DailyPlanItem" i
JOIN "DailyPlan" p ON p."id" = i."dailyPlanId"
JOIN "User" u ON u."id" = p."userId"
WHERE i."slot" = 5;

DELETE FROM "Task"
WHERE "id" IN (
  SELECT "taskId" FROM "DailyPlanItem" WHERE "slot" = 5 AND "taskId" IS NOT NULL
);

UPDATE "DailyPlanItem" SET "status" = 'BACKLOG' WHERE "slot" = 5;

UPDATE "Task"
SET "status" = 'BACKLOG'
WHERE "status" = 'TODO'
  AND "id" IN (
    SELECT "taskId" FROM "DailyPlanItem" WHERE "slot" = 4 AND "taskId" IS NOT NULL
  );
