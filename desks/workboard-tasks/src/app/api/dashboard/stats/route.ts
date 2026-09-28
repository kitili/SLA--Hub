import { NextRequest, NextResponse } from "next/server";
import { startOfDay } from "date-fns";
import { db } from "@/lib/db";
import { assertApiSecret } from "@/lib/auth/api-secret";

export async function GET(request: NextRequest) {
  try {
    assertApiSecret(request);
    const organizationId = request.nextUrl.searchParams.get("organizationId") ?? undefined;
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
      where: organizationId
        ? { task: { organizationId } }
        : undefined,
      include: {
        task: { select: { id: true, title: true, status: true } },
        user: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      counts: {
        backlog,
        inProgress,
        completed,
        blocked,
        users,
        messagesToday,
        dailyPlansToday,
      },
      recentActivity,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
