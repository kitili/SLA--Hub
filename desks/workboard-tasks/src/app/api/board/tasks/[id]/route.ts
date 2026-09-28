import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canMoveTask, cardOwnerId } from "@/lib/board/access";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getTaskDetail } from "@/lib/data/board";
import { syncDailyItemStatus } from "@/lib/services/daily-sheet";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z
    .enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "BLOCKED", "CANCELLED"])
    .optional(),
  type: z.enum(["TASK", "STORY", "BUG"]).optional(),
  priority: z.enum(["LOWEST", "LOW", "MEDIUM", "HIGH", "HIGHEST"]).nullable().optional(),
  shareWith: z.string().optional(),
  handoverTo: z.string().optional(),
  labels: z.array(z.string()).optional(),
  storyPoints: z.number().int().min(0).max(100).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  columnOrder: z.number().int().optional(),
  blockerNote: z.string().nullable().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const task = await getTaskDetail(id);

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(task);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = updateSchema.parse(await request.json());

    const session = await getSessionUser();
    if (!session) return NextResponse.json({ error: "Log in first" }, { status: 401 });

    const existing = await db.task.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const ownerId = cardOwnerId(existing);
    const moving = body.status && body.status !== existing.status;
    if (moving && !canMoveTask(existing, session.id)) {
      return NextResponse.json({ error: "You can only move a card you own, or one shared with you." }, { status: 403 });
    }
    if ((body.shareWith || body.handoverTo) && session.id !== ownerId) {
      return NextResponse.json({ error: "Only the card owner can share or hand it over." }, { status: 403 });
    }

    const sharedWithIds = body.handoverTo
      ? []
      : body.shareWith
        ? Array.from(new Set([...existing.sharedWithIds, body.shareWith]))
        : undefined;

    const task = await db.task.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        status: body.status,
        type: body.type,
        priority: body.priority,
        assigneeId: body.handoverTo ?? body.shareWith,
        moveOwnerId: body.handoverTo ?? undefined,
        sharedWithIds,
        labels: body.labels,
        storyPoints: body.storyPoints,
        dueDate: body.dueDate === null ? null : body.dueDate ? new Date(body.dueDate) : undefined,
        columnOrder: body.columnOrder,
        blockerNote: body.blockerNote,
        completedAt: body.status
          ? body.status === "COMPLETED"
            ? new Date()
            : body.status === existing.status
              ? undefined
              : null
          : undefined,
      },
      include: {
        assignee: { select: { id: true, name: true, phone: true } },
        project: { select: { id: true, name: true, key: true } },
        _count: { select: { comments: true } },
      },
    });

    if (body.status && body.status !== existing.status) {
      await syncDailyItemStatus(task.id, body.status);
      await db.taskActivity.create({
        data: {
          taskId: task.id,
          type: "STATUS_CHANGED",
          fromStatus: existing.status,
          toStatus: body.status,
          message: "Moved on board",
        },
      });
    }

    return NextResponse.json(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
