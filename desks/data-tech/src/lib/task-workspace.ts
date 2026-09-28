import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  systemTaskActivity,
  systemTaskAssignees,
  systemTaskChecklistItems,
  systemTaskChecklists,
  systemTaskComments,
  systemTaskTags,
  systemTaskTimeEntries,
  systemTasks,
} from "@/db/schema";
import { SAFE_USER_COLUMNS } from "@/lib/safe-columns";
import type { BoardTask, TaskDetail, TaskRecurrence } from "@/lib/task-types";

const TAG_COLORS = ["#7B68EE", "#002368", "#80bfec", "#ffc952", "#ef4444", "#22c55e", "#f97316", "#ec4899"];

export function nextTagColor(index: number) {
  return TAG_COLORS[index % TAG_COLORS.length]!;
}

function person(user: { id: string; name: string; email?: string | null } | null | undefined) {
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email ?? null };
}

export async function nextTaskNumber(systemId: string) {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${systemTasks.taskNumber}), 0)::int` })
    .from(systemTasks)
    .where(eq(systemTasks.systemId, systemId));
  return (row?.max ?? 0) + 1;
}

export async function replaceTaskAssignees(taskId: string, userIds: string[]) {
  const unique = [...new Set(userIds)];
  await db.delete(systemTaskAssignees).where(eq(systemTaskAssignees.taskId, taskId));
  if (unique.length) {
    await db.insert(systemTaskAssignees).values(unique.map((userId) => ({ taskId, userId })));
  }
  await db
    .update(systemTasks)
    .set({ assigneeId: unique[0] ?? null, updatedAt: new Date() })
    .where(eq(systemTasks.id, taskId));
}

export async function logTaskActivity(taskId: string, actorId: string | null, verb: string, detail?: string) {
  await db.insert(systemTaskActivity).values({ taskId, actorId, verb, detail: detail ?? null });
}

function addDays(date: string, days: number) {
  const next = new Date(`${date}T12:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function nextRecurrenceDate(date: string | null, recurrence: TaskRecurrence) {
  const base = date ?? new Date().toISOString().slice(0, 10);
  if (recurrence === "daily") return addDays(base, 1);
  if (recurrence === "weekly") return addDays(base, 7);
  if (recurrence === "monthly") return addDays(base, 30);
  return null;
}

export async function loadBoardTasks(systemId: string, includeArchived = false): Promise<BoardTask[]> {
  const tasks = await db.query.systemTasks.findMany({
    where: includeArchived
      ? eq(systemTasks.systemId, systemId)
      : and(eq(systemTasks.systemId, systemId), eq(systemTasks.archived, false)),
    orderBy: [asc(systemTasks.position), asc(systemTasks.createdAt)],
    with: {
      assignee: { columns: SAFE_USER_COLUMNS },
      assignees: { with: { user: { columns: SAFE_USER_COLUMNS } } },
      tagLinks: { with: { tag: true } },
      phase: true,
      sprint: true,
    },
  });

  const ids = tasks.map((t) => t.id);
  if (ids.length === 0) return [];

  const [timeRows, commentRows, checklistRows] = await Promise.all([
    db
      .select({
        taskId: systemTaskTimeEntries.taskId,
        minutes: sql<number>`coalesce(sum(${systemTaskTimeEntries.minutes}), 0)::int`,
      })
      .from(systemTaskTimeEntries)
      .where(inArray(systemTaskTimeEntries.taskId, ids))
      .groupBy(systemTaskTimeEntries.taskId),
    db
      .select({
        taskId: systemTaskComments.taskId,
        count: sql<number>`count(*)::int`,
      })
      .from(systemTaskComments)
      .where(inArray(systemTaskComments.taskId, ids))
      .groupBy(systemTaskComments.taskId),
    db
      .select({ id: systemTaskChecklists.id, taskId: systemTaskChecklists.taskId })
      .from(systemTaskChecklists)
      .where(inArray(systemTaskChecklists.taskId, ids)),
  ]);
  const itemRows = checklistRows.length
    ? await db
        .select()
        .from(systemTaskChecklistItems)
        .where(
          inArray(
            systemTaskChecklistItems.checklistId,
            checklistRows.map((row) => row.id),
          ),
        )
    : [];

  const timeByTask = new Map(timeRows.map((r) => [r.taskId, r.minutes]));
  const commentsByTask = new Map(commentRows.map((r) => [r.taskId, r.count]));
  const checklistsByTask = new Map<string, string[]>();
  for (const row of checklistRows) {
    const list = checklistsByTask.get(row.taskId) ?? [];
    list.push(row.id);
    checklistsByTask.set(row.taskId, list);
  }
  const itemsByChecklist = new Map<string, { done: boolean }[]>();
  for (const item of itemRows) {
    const list = itemsByChecklist.get(item.checklistId) ?? [];
    list.push({ done: item.done });
    itemsByChecklist.set(item.checklistId, list);
  }

  const children = new Map<string, { total: number; done: number }>();
  for (const task of tasks) {
    if (!task.parentTaskId) continue;
    const current = children.get(task.parentTaskId) ?? { total: 0, done: 0 };
    current.total += 1;
    if (task.status === "done") current.done += 1;
    children.set(task.parentTaskId, current);
  }

  return tasks.map((task) => {
    const checklistIds = checklistsByTask.get(task.id) ?? [];
    const items = checklistIds.flatMap((id) => itemsByChecklist.get(id) ?? []);
    const child = children.get(task.id) ?? { total: 0, done: 0 };
    const assignees = task.assignees
      .map((row) => person(row.user))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
    return {
      id: task.id,
      systemId: task.systemId,
      parentTaskId: task.parentTaskId,
      phaseId: task.phaseId,
      sprintId: task.sprintId,
      phaseName: task.phase?.name ?? null,
      sprintName: task.sprint ? `Sprint ${task.sprint.number}` : null,
      taskNumber: task.taskNumber,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      completionPercentage: task.completionPercentage,
      startDate: task.startDate,
      dueDate: task.dueDate,
      timeEstimateMinutes: task.timeEstimateMinutes,
      timeSpentMinutes: timeByTask.get(task.id) ?? 0,
      points: task.points,
      recurrence: task.recurrence,
      archived: task.archived,
      position: task.position,
      assignee: person(task.assignee) ?? assignees[0] ?? null,
      assignees,
      tags: task.tagLinks.map((link) => ({ id: link.tag.id, name: link.tag.name, color: link.tag.color })),
      subtaskCount: child.total,
      subtaskDone: child.done,
      checklistDone: items.filter((i) => i.done).length,
      checklistTotal: items.length,
      commentCount: commentsByTask.get(task.id) ?? 0,
    };
  });
}

export async function loadTaskDetail(taskId: string): Promise<TaskDetail | null> {
  const task = await db.query.systemTasks.findFirst({
    where: eq(systemTasks.id, taskId),
    with: {
      assignee: { columns: SAFE_USER_COLUMNS },
      assignees: { with: { user: { columns: SAFE_USER_COLUMNS } } },
      watchers: { with: { user: { columns: SAFE_USER_COLUMNS } } },
      tagLinks: { with: { tag: true } },
      comments: { with: { author: { columns: SAFE_USER_COLUMNS } } },
      checklists: { with: { items: true } },
      attachments: true,
      timeEntries: { with: { user: { columns: SAFE_USER_COLUMNS } } },
      activity: { with: { actor: { columns: SAFE_USER_COLUMNS } } },
      dependencies: { with: { dependsOn: true } },
      dependents: { with: { task: true } },
    },
  });
  if (!task) return null;

  const board = await loadBoardTasks(task.systemId, true);
  const self = board.find((t) => t.id === task.id);
  if (!self) return null;

  return {
    ...self,
    watchers: task.watchers.map((row) => person(row.user)).filter((p): p is NonNullable<typeof p> => Boolean(p)),
    checklists: [...task.checklists]
      .sort((a, b) => a.position - b.position)
      .map((list) => ({
      id: list.id,
      title: list.title,
      position: list.position,
      items: [...list.items]
        .sort((a, b) => a.position - b.position)
        .map((item) => ({
          id: item.id,
          title: item.title,
          done: item.done,
          assigneeId: item.assigneeId,
          position: item.position,
        })),
    })),
    comments: [...task.comments]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((comment) => ({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      author: person(comment.author),
    })),
    attachments: task.attachments.map((file) => ({
      id: file.id,
      url: file.url,
      filename: file.filename,
      mimeType: file.mimeType,
      size: file.size,
      uploadedAt: file.uploadedAt.toISOString(),
    })),
    timeEntries: [...task.timeEntries]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((entry) => ({
      id: entry.id,
      minutes: entry.minutes,
      note: entry.note,
      spentOn: entry.spentOn,
      createdAt: entry.createdAt.toISOString(),
      user: person(entry.user),
    })),
    activity: [...task.activity]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((row) => ({
      id: row.id,
      verb: row.verb,
      detail: row.detail,
      createdAt: row.createdAt.toISOString(),
      actor: person(row.actor),
    })),
    blockedBy: task.dependencies
      .filter((d) => d.dependsOn)
      .map((d) => ({
        id: d.dependsOn.id,
        title: d.dependsOn.title,
        status: d.dependsOn.status,
        taskNumber: d.dependsOn.taskNumber,
      })),
    blocking: task.dependents
      .filter((d) => d.task)
      .map((d) => ({
        id: d.task.id,
        title: d.task.title,
        status: d.task.status,
        taskNumber: d.task.taskNumber,
      })),
    subtasks: board.filter((t) => t.parentTaskId === task.id),
  };
}

export async function loadSystemTags(systemId: string) {
  return db.query.systemTaskTags.findMany({
    where: eq(systemTaskTags.systemId, systemId),
    orderBy: asc(systemTaskTags.name),
  });
}
