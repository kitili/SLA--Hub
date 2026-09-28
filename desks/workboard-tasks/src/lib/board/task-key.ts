import { db } from "@/lib/db";

export async function allocateTaskKey(projectId: string): Promise<string> {
  const project = await db.project.update({
    where: { id: projectId },
    data: { taskCounter: { increment: 1 } },
    select: { key: true, taskCounter: true },
  });

  return `${project.key}-${project.taskCounter}`;
}
