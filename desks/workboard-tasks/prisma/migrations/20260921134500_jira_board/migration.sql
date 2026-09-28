-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('TASK', 'STORY', 'BUG');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOWEST', 'LOW', 'MEDIUM', 'HIGH', 'HIGHEST');

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'TODO';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'IN_REVIEW';

-- AlterTable Project
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "key" TEXT NOT NULL DEFAULT 'PRJ';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "taskCounter" INTEGER NOT NULL DEFAULT 0;

-- AlterTable Task
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "taskKey" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "type" "TaskType" NOT NULL DEFAULT 'TASK';
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "labels" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "storyPoints" INTEGER;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "columnOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);

-- Migrate priority from integer to enum
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "priority_new" "TaskPriority" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "Task" DROP COLUMN IF EXISTS "priority";
ALTER TABLE "Task" RENAME COLUMN "priority_new" TO "priority";

-- CreateTable TaskComment
CREATE TABLE IF NOT EXISTS "TaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- Set project keys before unique constraint
UPDATE "Project" SET "key" = 'OPS' WHERE "name" = 'Operations';
UPDATE "Project" SET "key" = 'CLD' WHERE "name" = 'Client Delivery';
UPDATE "Project" SET "key" = 'PRJ' || substr(id, 1, 4) WHERE "key" = 'PRJ';

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Project_organizationId_key_key" ON "Project"("organizationId", "key");
CREATE UNIQUE INDEX IF NOT EXISTS "Task_taskKey_key" ON "Task"("taskKey");
CREATE INDEX IF NOT EXISTS "Task_projectId_status_columnOrder_idx" ON "Task"("projectId", "status", "columnOrder");
CREATE INDEX IF NOT EXISTS "TaskComment_taskId_createdAt_idx" ON "TaskComment"("taskId", "createdAt");

-- AddForeignKey
ALTER TABLE "TaskComment" DROP CONSTRAINT IF EXISTS "TaskComment_taskId_fkey";
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskComment" DROP CONSTRAINT IF EXISTS "TaskComment_userId_fkey";
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
