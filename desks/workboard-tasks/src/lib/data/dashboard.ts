import { startOfDay } from "date-fns";
import { db } from "@/lib/db";

export async function getDefaultOrganization() {
  return db.organization.findFirst({
    orderBy: { createdAt: "asc" },
  });
}

export async function getDashboardStats(organizationId?: string) {
  const today = startOfDay(new Date());

  const [backlog, inProgress, completed, blocked, users, messagesToday, dailyPlansToday] =
    await Promise.all([
      db.task.count({ where: { organizationId, status: "BACKLOG" } }),
      db.task.count({ where: { organizationId, status: "IN_PROGRESS" } }),
      db.task.count({ where: { organizationId, status: "COMPLETED" } }),
      db.task.count({ where: { organizationId, status: "BLOCKED" } }),
      db.user.count({ where: { organizationId, isActive: true } }),
      db.chatMessage.count({
        where: {
          createdAt: { gte: today },
          user: organizationId ? { organizationId } : undefined,
        },
      }),
      db.dailyPlan.count({
        where: {
          planDate: today,
          user: organizationId ? { organizationId } : undefined,
        },
      }),
    ]);

  const recentActivity = await db.taskActivity.findMany({
    where: organizationId ? { task: { organizationId } } : undefined,
    include: {
      task: { select: { id: true, title: true, status: true } },
      user: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  return {
    counts: { backlog, inProgress, completed, blocked, users, messagesToday, dailyPlansToday },
    recentActivity,
  };
}

export async function getTasks(organizationId?: string) {
  return db.task.findMany({
    where: { organizationId },
    include: {
      assignee: { select: { id: true, name: true, phone: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
}

export async function getProjects(organizationId?: string) {
  return db.project.findMany({
    where: { organizationId, isActive: true },
    include: {
      tasks: {
        select: { id: true, status: true },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getRecentMessages(organizationId?: string) {
  return db.chatMessage.findMany({
    where: organizationId
      ? {
          user: { organizationId },
        }
      : undefined,
    include: {
      user: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
