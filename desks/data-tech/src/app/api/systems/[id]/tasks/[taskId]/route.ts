import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { systemTasks } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { updateTaskSchema } from "@/lib/validation/system";
import { getSystemAndPermissions, notifyTaskAssignee } from "@/lib/systems";
import {
  loadBoardTasks,
  loadTaskDetail,
  logTaskActivity,
  nextRecurrenceDate,
  nextTaskNumber,
  replaceTaskAssignees,
} from "@/lib/task-workspace";
import { assertPhaseInSystem, assertSprintInSystem } from "@/lib/planning";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { response } = await requireModule("systems", "view");
  if (response) return response;

  const { taskId } = await params;
  const task = await loadTaskDetail(taskId);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ task });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { session, response } = await requireModule("systems", "view");
  if (response) return response;

  const { taskId } = await params;
  const [existingTask] = await db.select().from(systemTasks).where(eq(systemTasks.id, taskId)).limit(1);
  if (!existingTask) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { system, permissions } = await getSystemAndPermissions(existingTask.systemId, session.user);
  if (!system) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!permissions.canEditTask) {
    return NextResponse.json(
      { error: "Only the project lead or a Systems manager can edit tasks while this project is closed" },
      { status: 403 },
    );
  }

  const parsed = updateTaskSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { assigneeId, assigneeIds, phaseId, sprintId, ...rest } = parsed.data;
  let nextPhaseId = phaseId === undefined ? existingTask.phaseId : phaseId;
  let nextSprintId = sprintId === undefined ? existingTask.sprintId : sprintId;
  if (sprintId !== undefined) {
    if (sprintId) {
      const sprint = await assertSprintInSystem(sprintId, existingTask.systemId);
      if (!sprint) return NextResponse.json({ error: "Sprint not found" }, { status: 400 });
      if (phaseId === undefined) nextPhaseId = sprint.phaseId;
      nextSprintId = sprint.id;
    } else {
      nextSprintId = null;
    }
  }
  if (nextPhaseId && !(await assertPhaseInSystem(nextPhaseId, existingTask.systemId))) {
    return NextResponse.json({ error: "Phase not found" }, { status: 400 });
  }
  const assignees = assigneeId !== undefined ? { assigneeId } : null;

  const [updated] = await db
    .update(systemTasks)
    .set({
      ...rest,
      phaseId: nextPhaseId,
      sprintId: nextSprintId,
      ...(assignees ? { assigneeId: assignees.assigneeId } : {}),
      updatedAt: new Date(),
    })
    .where(eq(systemTasks.id, taskId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (assigneeIds) {
    await replaceTaskAssignees(updated.id, assigneeIds);
  } else if (assignees?.assigneeId) {
    await replaceTaskAssignees(updated.id, [assignees.assigneeId]);
  } else if (assignees && !assignees.assigneeId) {
    await replaceTaskAssignees(updated.id, []);
  }

  if (updated.title !== existingTask.title) {
    await logTaskActivity(updated.id, session.user.id, "renamed", updated.title);
  }
  if (updated.status !== existingTask.status) {
    await logTaskActivity(updated.id, session.user.id, "status", `${existingTask.status} → ${updated.status}`);
  }
  if (updated.archived !== existingTask.archived) {
    await logTaskActivity(updated.id, session.user.id, updated.archived ? "archived" : "restored");
  }

  if (updated.assigneeId && updated.assigneeId !== existingTask.assigneeId) {
    await notifyTaskAssignee({
      assigneeId: updated.assigneeId,
      systemId: system.id,
      systemName: system.name,
      taskTitle: updated.title,
      priority: updated.priority,
      dueDate: updated.dueDate,
    });
    await logTaskActivity(updated.id, session.user.id, "assigned");
  }

  if (updated.status === "done" && existingTask.status !== "done" && updated.recurrence !== "none") {
    const nextDue = nextRecurrenceDate(updated.dueDate, updated.recurrence);
    const nextStart = updated.startDate ? nextRecurrenceDate(updated.startDate, updated.recurrence) : null;
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(systemTasks)
      .where(and(eq(systemTasks.systemId, updated.systemId), eq(systemTasks.status, "todo")));
    const [spawned] = await db
      .insert(systemTasks)
      .values({
        systemId: updated.systemId,
        parentTaskId: updated.parentTaskId,
        phaseId: updated.phaseId,
        sprintId: updated.sprintId,
        taskNumber: await nextTaskNumber(updated.systemId),
        title: updated.title,
        description: updated.description,
        status: "todo",
        priority: updated.priority,
        assigneeId: updated.assigneeId,
        startDate: nextStart,
        dueDate: nextDue,
        timeEstimateMinutes: updated.timeEstimateMinutes,
        points: updated.points,
        recurrence: updated.recurrence,
        position: count,
        createdBy: session.user.id,
      })
      .returning();
    if (spawned.assigneeId) await replaceTaskAssignees(spawned.id, [spawned.assigneeId]);
    await logTaskActivity(spawned.id, session.user.id, "created", "Recurring copy");
  }

  const [boardTask] = (await loadBoardTasks(updated.systemId, true)).filter((t) => t.id === updated.id);

  return NextResponse.json({ task: boardTask ?? updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { session, response } = await requireModule("systems", "view");
  if (response) return response;

  const { taskId } = await params;
  const [existingTask] = await db.select().from(systemTasks).where(eq(systemTasks.id, taskId)).limit(1);
  if (!existingTask) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { system, permissions } = await getSystemAndPermissions(existingTask.systemId, session.user);
  if (!system) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!permissions.canDeleteTask) {
    return NextResponse.json(
      { error: "Only the project lead or a Systems manager can delete tasks" },
      { status: 403 },
    );
  }

  const [deleted] = await db.delete(systemTasks).where(eq(systemTasks.id, taskId)).returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
