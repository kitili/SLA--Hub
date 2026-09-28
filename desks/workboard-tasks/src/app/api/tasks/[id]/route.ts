import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertApiSecret } from "@/lib/auth/api-secret";

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z
    .enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "BLOCKED", "CANCELLED"])
    .optional(),
  blockerNote: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    assertApiSecret(request);
    const { id } = await context.params;

    const task = await db.task.findUnique({
      where: { id },
      include: {
        assignee: true,
        project: true,
        activities: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, name: true, phone: true } } },
        },
        dailyItem: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    assertApiSecret(request);
    const { id } = await context.params;
    const body = updateTaskSchema.parse(await request.json());

    const existing = await db.task.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const task = await db.task.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        status: body.status,
        blockerNote: body.blockerNote,
        assigneeId: body.assigneeId,
        projectId: body.projectId,
        completedAt: body.status
          ? body.status === "COMPLETED"
            ? new Date()
            : null
          : undefined,
      },
      include: {
        assignee: true,
        project: true,
      },
    });

    if (body.status && body.status !== existing.status) {
      await db.taskActivity.create({
        data: {
          taskId: task.id,
          type: "STATUS_CHANGED",
          fromStatus: existing.status,
          toStatus: body.status,
          message: "Updated via dashboard/API",
        },
      });
    }

    return NextResponse.json(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
