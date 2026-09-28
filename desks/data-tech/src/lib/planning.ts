import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  sprintCapacities,
  systemPhases,
  systemSprints,
  systemTaskActivity,
  systemTasks,
  systems,
  users,
} from "@/db/schema";
import { SAFE_USER_COLUMNS } from "@/lib/safe-columns";
import type {
  BurndownPoint,
  ProjectPhase,
  ProjectSprint,
  SprintCapacity,
  SprintVelocity,
} from "@/lib/task-types";

export async function nextSprintNumber(systemId: string) {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${systemSprints.number}), 0)::int` })
    .from(systemSprints)
    .where(eq(systemSprints.systemId, systemId));
  return (row?.max ?? 0) + 1;
}

export async function nextPhasePosition(systemId: string) {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${systemPhases.position}), -1)::int` })
    .from(systemPhases)
    .where(eq(systemPhases.systemId, systemId));
  return (row?.max ?? -1) + 1;
}

export async function loadPhases(systemId: string): Promise<ProjectPhase[]> {
  const rows = await db.query.systemPhases.findMany({
    where: eq(systemPhases.systemId, systemId),
    orderBy: [asc(systemPhases.position), asc(systemPhases.createdAt)],
    with: { tasks: { columns: { status: true, archived: true } } },
  });
  return rows.map((phase) => {
    const live = phase.tasks.filter((t) => !t.archived);
    return {
      id: phase.id,
      name: phase.name,
      goal: phase.goal,
      position: phase.position,
      startDate: phase.startDate,
      targetDate: phase.targetDate,
      taskCount: live.length,
      doneCount: live.filter((t) => t.status === "done").length,
    };
  });
}

export async function loadSprints(systemId: string): Promise<ProjectSprint[]> {
  const rows = await db.query.systemSprints.findMany({
    where: eq(systemSprints.systemId, systemId),
    orderBy: [asc(systemSprints.number)],
    with: {
      phase: true,
      tasks: { columns: { status: true, archived: true, points: true } },
    },
  });
  return rows.map((sprint) => {
    const live = sprint.tasks.filter((t) => !t.archived);
    const done = live.filter((t) => t.status === "done");
    return {
      id: sprint.id,
      systemId: sprint.systemId,
      phaseId: sprint.phaseId,
      phaseName: sprint.phase?.name ?? null,
      number: sprint.number,
      name: sprint.name,
      goal: sprint.goal,
      status: sprint.status,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      taskCount: live.length,
      doneCount: done.length,
      pointsCommitted: live.reduce((sum, t) => sum + (t.points ?? 0), 0),
      pointsDone: done.reduce((sum, t) => sum + (t.points ?? 0), 0),
      reviewNotes: sprint.reviewNotes,
      retroWentWell: sprint.retroWentWell,
      retroImprove: sprint.retroImprove,
      retroActions: sprint.retroActions,
    };
  });
}

function eachDate(start: string, end: string) {
  const dates: string[] = [];
  const cursor = new Date(`${start}T12:00:00.000Z`);
  const last = new Date(`${end}T12:00:00.000Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime())) return dates;
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export async function loadVelocity(systemId: string): Promise<SprintVelocity> {
  const sprints = await loadSprints(systemId);
  const samples = sprints
    .filter((s) => s.status === "completed")
    .slice(-6)
    .map((s) => ({ number: s.number, name: s.name, pointsDone: s.pointsDone }));
  const averagePoints = samples.length
    ? Math.round(samples.reduce((sum, s) => sum + s.pointsDone, 0) / samples.length)
    : 0;
  return { averagePoints, samples };
}

export async function loadBurndown(sprintId: string): Promise<BurndownPoint[]> {
  const [sprint] = await db.select().from(systemSprints).where(eq(systemSprints.id, sprintId)).limit(1);
  if (!sprint?.startDate || !sprint.endDate) return [];

  const tasks = await db
    .select({
      id: systemTasks.id,
      points: systemTasks.points,
      status: systemTasks.status,
      updatedAt: systemTasks.updatedAt,
      archived: systemTasks.archived,
    })
    .from(systemTasks)
    .where(eq(systemTasks.sprintId, sprintId));
  const live = tasks.filter((t) => !t.archived);
  const committed = live.reduce((sum, t) => sum + (t.points ?? 1), 0);
  const ids = live.map((t) => t.id);
  const activities = ids.length
    ? await db
        .select()
        .from(systemTaskActivity)
        .where(and(inArray(systemTaskActivity.taskId, ids), eq(systemTaskActivity.verb, "status")))
    : [];

  const doneOn = new Map<string, string>();
  for (const row of activities) {
    if (!row.detail?.includes("→ done")) continue;
    const day = row.createdAt.toISOString().slice(0, 10);
    const prev = doneOn.get(row.taskId);
    if (!prev || day < prev) doneOn.set(row.taskId, day);
  }
  for (const task of live) {
    if (task.status === "done" && !doneOn.has(task.id)) {
      doneOn.set(task.id, task.updatedAt.toISOString().slice(0, 10));
    }
  }

  const dates = eachDate(sprint.startDate, sprint.endDate);
  const today = new Date().toISOString().slice(0, 10);
  return dates.map((date, index) => {
    const ideal = dates.length <= 1 ? 0 : Math.round(committed * (1 - index / (dates.length - 1)));
    const burned = live
      .filter((t) => {
        const day = doneOn.get(t.id);
        return day && day <= date;
      })
      .reduce((sum, t) => sum + (t.points ?? 1), 0);
    const remaining = date > today ? Math.max(committed - burned, 0) : Math.max(committed - burned, 0);
    return { date, ideal, remaining };
  });
}

export async function loadCapacities(sprintId: string, defaultPoints = 8): Promise<SprintCapacity[]> {
  const [sprint] = await db.select({ systemId: systemSprints.systemId }).from(systemSprints).where(eq(systemSprints.id, sprintId)).limit(1);
  if (!sprint) return [];

  const [system] = await db
    .select({ defaultCapacityPoints: systems.defaultCapacityPoints, defaultCapacityMinutes: systems.defaultCapacityMinutes })
    .from(systems)
    .where(eq(systems.id, sprint.systemId))
    .limit(1);

  const rows = await db.query.sprintCapacities.findMany({
    where: eq(sprintCapacities.sprintId, sprintId),
    with: { user: { columns: SAFE_USER_COLUMNS } },
  });
  const tasks = await db.query.systemTasks.findMany({
    where: and(eq(systemTasks.sprintId, sprintId), eq(systemTasks.archived, false)),
    with: { assignees: true },
  });

  const assignedPoints = new Map<string, number>();
  const assignedMinutes = new Map<string, number>();
  for (const task of tasks) {
    const people = task.assignees.length ? task.assignees.map((a) => a.userId) : task.assigneeId ? [task.assigneeId] : [];
    if (!people.length) continue;
    const sharePoints = (task.points ?? 0) / people.length;
    const shareMinutes = (task.timeEstimateMinutes ?? 0) / people.length;
    for (const userId of people) {
      assignedPoints.set(userId, (assignedPoints.get(userId) ?? 0) + sharePoints);
      assignedMinutes.set(userId, (assignedMinutes.get(userId) ?? 0) + shareMinutes);
    }
  }

  const byUser = new Map<string, SprintCapacity>();
  for (const row of rows) {
    if (!row.user) continue;
    byUser.set(row.userId, {
      userId: row.userId,
      name: row.user.name,
      points: row.points,
      minutes: row.minutes,
      assignedPoints: Math.round(assignedPoints.get(row.userId) ?? 0),
      assignedMinutes: Math.round(assignedMinutes.get(row.userId) ?? 0),
    });
  }
  const missingIds = [...assignedPoints.keys()].filter((id) => !byUser.has(id));
  if (missingIds.length) {
    const people = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, missingIds));
    for (const person of people) {
      byUser.set(person.id, {
        userId: person.id,
        name: person.name,
        points: system?.defaultCapacityPoints ?? defaultPoints,
        minutes: system?.defaultCapacityMinutes ?? 0,
        assignedPoints: Math.round(assignedPoints.get(person.id) ?? 0),
        assignedMinutes: Math.round(assignedMinutes.get(person.id) ?? 0),
      });
    }
  }

  return [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadCurrentSprints(): Promise<ProjectSprint[]> {
  const rows = await db.query.systemSprints.findMany({
    where: ne(systemSprints.status, "completed"),
    orderBy: [asc(systemSprints.status), asc(systemSprints.endDate)],
    with: {
      system: true,
      phase: true,
      tasks: { columns: { status: true, archived: true, points: true } },
    },
  });
  return rows.map((sprint) => {
    const live = sprint.tasks.filter((t) => !t.archived);
    const done = live.filter((t) => t.status === "done");
    return {
      id: sprint.id,
      systemId: sprint.systemId,
      systemName: sprint.system?.name ?? "System",
      phaseId: sprint.phaseId,
      phaseName: sprint.phase?.name ?? null,
      number: sprint.number,
      name: sprint.name,
      goal: sprint.goal,
      status: sprint.status,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      taskCount: live.length,
      doneCount: done.length,
      pointsCommitted: live.reduce((sum, t) => sum + (t.points ?? 0), 0),
      pointsDone: done.reduce((sum, t) => sum + (t.points ?? 0), 0),
      reviewNotes: sprint.reviewNotes,
      retroWentWell: sprint.retroWentWell,
      retroImprove: sprint.retroImprove,
      retroActions: sprint.retroActions,
    };
  });
}

export async function assertPhaseInSystem(phaseId: string | null | undefined, systemId: string) {
  if (!phaseId) return null;
  const [row] = await db
    .select({ id: systemPhases.id })
    .from(systemPhases)
    .where(and(eq(systemPhases.id, phaseId), eq(systemPhases.systemId, systemId)))
    .limit(1);
  return row ?? null;
}

export async function assertSprintInSystem(sprintId: string | null | undefined, systemId: string) {
  if (!sprintId) return null;
  const [row] = await db
    .select()
    .from(systemSprints)
    .where(and(eq(systemSprints.id, sprintId), eq(systemSprints.systemId, systemId)))
    .limit(1);
  return row ?? null;
}

export function defaultSprintWindow(days = 14) {
  const start = new Date();
  const end = new Date();
  end.setDate(start.getDate() + days - 1);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}
