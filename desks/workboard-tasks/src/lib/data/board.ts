import { db } from "@/lib/db";
import type { TaskStatus } from "@/generated/prisma/client";
import { parkUnfinishedDailyTasks } from "@/lib/services/daily-sheet";

export async function getBoardProjects(organizationId?: string) {
  return db.project.findMany({
    where: { organizationId, isActive: true },
    include: {
      _count: { select: { tasks: true } },
    },
    orderBy: { name: "asc" },
  });
}

const taskInclude = {
  assignee: { select: { id: true, name: true, phone: true } },
  dailyItem: { select: { slot: true } },
  _count: { select: { comments: true } },
} as const;

export async function getOrganizationBoard(organizationId: string) {
  await parkUnfinishedDailyTasks(organizationId);
  const [org, tasks, users, project] = await Promise.all([
    db.organization.findUnique({ where: { id: organizationId } }),
    db.task.findMany({
      where: { organizationId, status: { notIn: ["CANCELLED", "COMPLETED"] } },
      include: taskInclude,
      orderBy: [{ columnOrder: "asc" }, { updatedAt: "desc" }],
    }),
    db.user.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true, username: true, phone: true },
      orderBy: { name: "asc" },
    }),
    db.project.findFirst({
      where: { organizationId, isActive: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!org) return null;

  return {
    project: {
      id: project?.id ?? org.id,
      name: org.name,
      key: "D5",
      description: "Everyone’s 1–5 becomes a task card. Drag it across the board.",
      organization: { id: org.id, name: org.name },
    },
    tasks,
    users,
  };
}

export async function getBoardData(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { organization: true },
  });

  if (!project) return null;

  const [tasks, users] = await Promise.all([
    db.task.findMany({
      where: { projectId },
      include: taskInclude,
      orderBy: [{ status: "asc" }, { columnOrder: "asc" }, { updatedAt: "desc" }],
    }),
    db.user.findMany({
      where: { organizationId: project.organizationId, isActive: true },
      select: { id: true, name: true, username: true, phone: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const columns = tasks.reduce<Record<TaskStatus, typeof tasks>>(
    (acc, task) => {
      if (!acc[task.status]) acc[task.status] = [];
      acc[task.status].push(task);
      return acc;
    },
    {} as Record<TaskStatus, typeof tasks>,
  );

  return { project, tasks, columns, users };
}

export async function getTaskDetail(taskId: string) {
  return db.task.findUnique({
    where: { id: taskId },
    include: {
      assignee: { select: { id: true, name: true, phone: true } },
      project: { select: { id: true, name: true, key: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true, phone: true } } },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { id: true, name: true, phone: true } } },
      },
    },
  });
}
