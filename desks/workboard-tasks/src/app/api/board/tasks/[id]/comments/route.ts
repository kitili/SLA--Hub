import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const commentSchema = z.object({
  body: z.string().min(1),
  userId: z.string().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: taskId } = await context.params;
    const body = commentSchema.parse(await request.json());

    const task = await db.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const comment = await db.taskComment.create({
      data: {
        taskId,
        userId: body.userId,
        body: body.body,
      },
      include: {
        user: { select: { id: true, name: true, phone: true } },
      },
    });

    await db.taskActivity.create({
      data: {
        taskId,
        userId: body.userId,
        type: "COMMENT",
        message: body.body.slice(0, 200),
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
