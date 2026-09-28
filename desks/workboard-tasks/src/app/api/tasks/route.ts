import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertApiSecret } from "@/lib/auth/api-secret";

const createTaskSchema = z.object({
  organizationId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  projectId: z.string().optional(),
  status: z
    .enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "BLOCKED", "CANCELLED"])
    .optional(),
  source: z.enum(["DAILY", "BACKLOG", "PROJECT", "MANUAL"]).optional(),
});

export async function GET(request: NextRequest) {
  try {
    assertApiSecret(request);

    const params = request.nextUrl.searchParams;
    const organizationId = params.get("organizationId") ?? undefined;
    const status = params.get("status") ?? undefined;
    const assigneeId = params.get("assigneeId") ?? undefined;
    const projectId = params.get("projectId") ?? undefined;
    const limit = Math.min(Number(params.get("limit") ?? 50), 200);
    const offset = Number(params.get("offset") ?? 0);

    const [tasks, total] = await Promise.all([
      db.task.findMany({
        where: {
          organizationId,
          status: status as never,
          assigneeId,
          projectId,
        },
        include: {
          assignee: { select: { id: true, name: true, phone: true } },
          project: { select: { id: true, name: true } },
          activities: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.task.count({
        where: {
          organizationId,
          status: status as never,
          assigneeId,
          projectId,
        },
      }),
    ]);

    return NextResponse.json({ tasks, total, limit, offset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    assertApiSecret(request);
    const body = createTaskSchema.parse(await request.json());

    const task = await db.task.create({
      data: {
        organizationId: body.organizationId,
        title: body.title,
        description: body.description,
        assigneeId: body.assigneeId,
        projectId: body.projectId,
        status: body.status ?? "BACKLOG",
        source: body.source ?? "MANUAL",
        completedAt: body.status === "COMPLETED" ? new Date() : null,
      },
      include: {
        assignee: true,
        project: true,
      },
    });

    await db.taskActivity.create({
      data: {
        taskId: task.id,
        userId: body.assigneeId,
        type: "CREATED",
        toStatus: task.status,
        message: "Created via API",
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
