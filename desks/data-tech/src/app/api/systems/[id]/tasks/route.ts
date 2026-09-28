import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { systemTaskWatchers, systemTasks } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { createTaskSchema } from "@/lib/validation/system";
import { getSystemAndPermissions, notifyTaskAssignee } from "@/lib/systems";
import {
  loadBoardTasks,
  logTaskActivity,
  nextTaskNumber,
  replaceTaskAssignees,
} from "@/lib/task-workspace";
import { assertPhaseInSystem, assertSprintInSystem } from "@/lib/planning";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireModule("systems", "view");
  if (response) return response;

  const { id: systemId } = await params;
  const includeArchived = req.nextUrl.searchParams.get("archived") === "1";
  const tasks = await loadBoardTasks(systemId, includeArchived);
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireModule("systems", "view");
  if (response) return response;

  const { id: systemId } = await params;
  const { system, permissions } = await getSystemAndPermissions(systemId, session.user);
  if (!system) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!permissions.canCreateTask) {
    return NextResponse.json(
      { error: "Only the project lead or a Systems manager can add tasks while this project is closed" },
      { status: 403 },
    );
  }

  const parsed = createTaskSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  let phaseId = parsed.data.phaseId ?? null;
  const sprintId = parsed.data.sprintId ?? null;
  if (sprintId) {
    const sprint = await assertSprintInSystem(sprintId, systemId);
    if (!sprint) return NextResponse.json({ error: "Sprint not found" }, { status: 400 });
    if (!phaseId) phaseId = sprint.phaseId;
  }
  if (phaseId && !(await assertPhaseInSystem(phaseId, systemId))) {
    return NextResponse.json({ error: "Phase not found" }, { status: 400 });
  }

  if (parsed.data.parentTaskId) {
    const [parent] = await db
      .select({ id: systemTasks.id, systemId: systemTasks.systemId })
      .from(systemTasks)
      .where(eq(systemTasks.id, parsed.data.parentTaskId))
      .limit(1);
    if (!parent || parent.systemId !== systemId) {
      return NextResponse.json({ error: "Parent task not found" }, { status: 400 });
    }
  }

  const status = parsed.data.status ?? "backlog";
  const assigneeId = parsed.data.assigneeIds?.[0] ?? parsed.data.assigneeId ?? null;
  const parentFilter = parsed.data.parentTaskId
    ? eq(systemTasks.parentTaskId, parsed.data.parentTaskId)
    : isNull(systemTasks.parentTaskId);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(systemTasks)
    .where(and(eq(systemTasks.systemId, systemId), eq(systemTasks.status, status), parentFilter));

  const [task] = await db
    .insert(systemTasks)
    .values({
      systemId,
      parentTaskId: parsed.data.parentTaskId,
      phaseId,
      sprintId,
      taskNumber: await nextTaskNumber(systemId),
      title: parsed.data.title,
      description: parsed.data.description,
      status,
      priority: parsed.data.priority,
      assigneeId,
      completionPercentage: parsed.data.completionPercentage,
      startDate: parsed.data.startDate,
      dueDate: parsed.data.dueDate,
      timeEstimateMinutes: parsed.data.timeEstimateMinutes,
      points: parsed.data.points,
      recurrence: parsed.data.recurrence,
      position: count,
      createdBy: session.user.id,
    })
    .returning();

  const assigneeIds = parsed.data.assigneeIds ?? (assigneeId ? [assigneeId] : []);
  if (assigneeIds.length) {
    await replaceTaskAssignees(task.id, assigneeIds);
  }
  await db.insert(systemTaskWatchers).values({ taskId: task.id, userId: session.user.id }).onConflictDoNothing();
  await logTaskActivity(task.id, session.user.id, "created", task.title);

  if (assigneeIds[0]) {
    await notifyTaskAssignee({
      assigneeId: assigneeIds[0],
      systemId,
      systemName: system.name,
      taskTitle: task.title,
      priority: task.priority,
      dueDate: task.dueDate,
    });
  }

  const [boardTask] = (await loadBoardTasks(systemId, true)).filter((t) => t.id === task.id);

  return NextResponse.json({ task: boardTask ?? task }, { status: 201 });
}
