import { and, asc, eq, gte, inArray, lte, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { departments, oneToFives, pulseChecks, systems, systemTaskAssignees, systemTasks, users } from "@/db/schema";
import { latestThursday, mondayOfWeek, addDays } from "@/lib/nairobi";
import { expectedSubmitters, isWorkDay } from "@/lib/one-to-fives";
import { SAFE_USER_COLUMNS } from "@/lib/safe-columns";

export const DESK_ORDER = [
  "Onboarding",
  "Uniforms",
  "Marketing",
  "Operations",
  "Data & Tech",
  "HR",
  "Academic",
  "Finance",
  "Facilities",
];

export function sortDesks<T extends { name: string }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const ai = DESK_ORDER.findIndex((name) => name.toLowerCase() === a.name.toLowerCase());
    const bi = DESK_ORDER.findIndex((name) => name.toLowerCase() === b.name.toLowerCase());
    const av = ai === -1 ? DESK_ORDER.length : ai;
    const bv = bi === -1 ? DESK_ORDER.length : bi;
    return av !== bv ? av - bv : a.name.localeCompare(b.name);
  });
}

export function countPhrase(n: number, singular: string, plural = `${singular}s`) {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function isSprintContainerTitle(title: string) {
  return /^Sprint \d+/.test(title);
}

function sprintRollup(
  sprints: {
    status: string;
    name: string;
    number: number;
    phase?: { name: string } | null;
    tasks: { status: string; archived: boolean; points: number | null }[];
  }[],
) {
  const liveSprints = sprints.filter((s) => s.status !== "completed");
  const focus = liveSprints.find((s) => s.status === "active") ?? liveSprints[0] ?? null;
  const live = (focus?.tasks ?? []).filter((t) => !t.archived);
  const done = live.filter((t) => t.status === "done");
  const taskCount = live.length;
  const doneCount = done.length;
  return {
    sprintName: focus ? `Sprint ${focus.number}: ${focus.name}` : null,
    sprintStatus: focus?.status ?? null,
    phaseName: focus?.phase?.name ?? null,
    taskCount,
    doneCount,
    pointsCommitted: live.reduce((sum, t) => sum + (t.points ?? 0), 0),
    pointsDone: done.reduce((sum, t) => sum + (t.points ?? 0), 0),
    pct: taskCount ? Math.round((doneCount / taskCount) * 100) : 0,
  };
}

function slotDone(value: string | null | undefined) {
  return value === "completed";
}

export async function loadAcademySnapshot(workDate: string) {
  const weekStart = mondayOfWeek(workDate);
  const weekThursday = latestThursday(workDate);
  const [depts, people, systemRows] = await Promise.all([
    db.select().from(departments).orderBy(asc(departments.name)),
    expectedSubmitters(),
    db.query.systems.findMany({
      with: {
        sprints: {
          with: {
            phase: true,
            tasks: { columns: { status: true, archived: true, points: true } },
          },
        },
      },
    }),
  ]);

  const weekPeopleIds = people.map((p) => p.id);
  const [weekEntries, pulses] = await Promise.all([
    weekPeopleIds.length
      ? db
          .select()
          .from(oneToFives)
          .where(and(inArray(oneToFives.userId, weekPeopleIds), gte(oneToFives.workDate, weekStart), lte(oneToFives.workDate, workDate)))
      : Promise.resolve([]),
    depts.length
      ? db.query.pulseChecks.findMany({
          where: and(inArray(pulseChecks.departmentId, depts.map((d) => d.id)), eq(pulseChecks.weekThursday, weekThursday)),
          with: { submitter: { columns: SAFE_USER_COLUMNS } },
        })
      : Promise.resolve([]),
  ]);

  const workDays: string[] = [];
  for (let cursor = weekStart; cursor <= workDate; cursor = addDays(cursor, 1)) {
    if (await isWorkDay(cursor)) workDays.push(cursor);
  }

  const pulseByDept = new Map(pulses.map((p) => [p.departmentId, p]));
  const entriesByUser = new Map<string, typeof weekEntries>();
  for (const row of weekEntries) {
    const list = entriesByUser.get(row.userId) ?? [];
    list.push(row);
    entriesByUser.set(row.userId, list);
  }

  const desks = sortDesks(depts).map((dept) => {
    const staff = people.filter((p) => p.departmentId === dept.id);
    const expected = staff.length * workDays.length;
    let filed = 0;
    let slots = 0;
    let slotsDone = 0;
    for (const person of staff) {
      for (const row of entriesByUser.get(person.id) ?? []) {
        if (row.submittedAt && row.status !== "missed") filed += 1;
        for (const [text, progress] of [
          [row.slot1, row.slot1Progress],
          [row.slot2, row.slot2Progress],
          [row.slot3, row.slot3Progress],
        ] as const) {
          if (!text) continue;
          slots += 1;
          if (slotDone(progress)) slotsDone += 1;
        }
      }
    }
    const projects = systemRows
      .filter((s) => s.departmentId === dept.id)
      .map((system) => ({
        id: system.id,
        name: system.name,
        ...sprintRollup(system.sprints),
      }));
    const projectPct =
      projects.length === 0
        ? 0
        : Math.round(projects.reduce((sum, p) => sum + p.pct, 0) / projects.length);
    const pulse = pulseByDept.get(dept.id) ?? null;
    return {
      id: dept.id,
      name: dept.name,
      staffCount: staff.length,
      filed,
      expected,
      slotsDone,
      slots,
      projectPct,
      projects,
      pulse: pulse
        ? {
            status: pulse.status,
            wins: pulse.wins,
            risks: pulse.risks,
            helpNeeded: pulse.helpNeeded,
            skipReason: pulse.skipReason,
          }
        : null,
    };
  });

  const totals = desks.reduce(
    (acc, desk) => {
      acc.filed += desk.filed;
      acc.expected += desk.expected;
      acc.slotsDone += desk.slotsDone;
      acc.slots += desk.slots;
      acc.projects += desk.projects.length;
      acc.projectPctSum += desk.projectPct;
      acc.desksWithProjects += desk.projects.length > 0 ? 1 : 0;
      return acc;
    },
    { filed: 0, expected: 0, slotsDone: 0, slots: 0, projects: 0, projectPctSum: 0, desksWithProjects: 0 },
  );

  return {
    workDate,
    weekStart,
    weekThursday,
    workDayCount: workDays.length,
    desks,
    totals: {
      ...totals,
      projectPct: totals.desksWithProjects ? Math.round(totals.projectPctSum / totals.desksWithProjects) : 0,
    },
  };
}

export async function loadDepartmentDesk(departmentId: string, workDate: string) {
  const [department] = await db.select().from(departments).where(eq(departments.id, departmentId)).limit(1);
  if (!department) return null;

  const weekStart = mondayOfWeek(workDate);
  const weekThursday = latestThursday(workDate);
  const people = (await expectedSubmitters()).filter((p) => p.departmentId === departmentId);
  const peopleIds = people.map((p) => p.id);

  const [projectRows, entries, [pulse]] = await Promise.all([
    db.query.systems.findMany({
      where: eq(systems.departmentId, departmentId),
      with: {
        lead: { columns: SAFE_USER_COLUMNS },
        phases: true,
        sprints: {
          with: {
            phase: true,
            tasks: { columns: { status: true, archived: true, points: true } },
          },
        },
      },
    }),
    peopleIds.length
      ? db.query.oneToFives.findMany({
          where: and(inArray(oneToFives.userId, peopleIds), gte(oneToFives.workDate, weekStart), lte(oneToFives.workDate, workDate)),
          with: {
            user: { columns: SAFE_USER_COLUMNS },
            feedback: {
              orderBy: (table, { asc: orderAsc }) => [orderAsc(table.createdAt)],
              with: { author: { columns: SAFE_USER_COLUMNS } },
            },
          },
        })
      : Promise.resolve([]),
    db.query.pulseChecks.findMany({
      where: and(eq(pulseChecks.departmentId, departmentId), eq(pulseChecks.weekThursday, weekThursday)),
      with: { submitter: { columns: SAFE_USER_COLUMNS } },
      limit: 1,
    }),
  ]);

  const projects = projectRows.map((system) => {
    const phases = [...system.phases].sort((a, b) => a.position - b.position);
    return {
      id: system.id,
      name: system.name,
      description: system.description,
      leadName: system.lead?.name ?? null,
      phases: phases.map((phase) => ({
        id: phase.id,
        name: phase.name,
        goal: phase.goal,
      })),
      ...sprintRollup(system.sprints),
    };
  });

  return {
    department,
    workDate,
    weekStart,
    weekThursday,
    people,
    entries,
    projects,
    pulse: pulse ?? null,
  };
}

export type DeskWorkItem = {
  id: string;
  systemId: string;
  systemName: string;
  taskNumber: number;
  title: string;
  status: string;
  dueDate: string | null;
  phaseName: string | null;
};

const WORK_RANK: Record<string, number> = { in_progress: 0, review: 1, todo: 2, backlog: 3 };

function toWorkItem(row: {
  id: string;
  systemId: string;
  taskNumber: number;
  title: string;
  status: string;
  dueDate: string | null;
  system?: { name: string } | null;
  phase?: { name: string } | null;
}): DeskWorkItem {
  return {
    id: row.id,
    systemId: row.systemId,
    systemName: row.system?.name ?? "Project",
    taskNumber: row.taskNumber,
    title: row.title,
    status: row.status,
    dueDate: row.dueDate,
    phaseName: row.phase?.name ?? null,
  };
}

function sortWork(rows: DeskWorkItem[]) {
  return [...rows].sort((a, b) => {
    const rank = (WORK_RANK[a.status] ?? 9) - (WORK_RANK[b.status] ?? 9);
    if (rank !== 0) return rank;
    return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  });
}

export async function loadMyWork(userId: string): Promise<DeskWorkItem[]> {
  const [assigned, [me]] = await Promise.all([
    db.select({ taskId: systemTaskAssignees.taskId }).from(systemTaskAssignees).where(eq(systemTaskAssignees.userId, userId)),
    db.select({ departmentId: users.departmentId }).from(users).where(eq(users.id, userId)).limit(1),
  ]);
  const extraIds = assigned.map((row) => row.taskId);
  const assignedRows = await db.query.systemTasks.findMany({
    where: and(
      eq(systemTasks.archived, false),
      ne(systemTasks.status, "done"),
      extraIds.length
        ? or(eq(systemTasks.assigneeId, userId), inArray(systemTasks.id, extraIds))
        : eq(systemTasks.assigneeId, userId),
    ),
    with: { system: true, phase: true },
  });
  const mine = sortWork(assignedRows.map(toWorkItem).filter((item) => !isSprintContainerTitle(item.title)));
  if (mine.length > 0) return mine.slice(0, 8);
  if (!me?.departmentId) return [];
  return loadDepartmentWork(me.departmentId).then((rows) => rows.slice(0, 8));
}

export async function loadDepartmentWork(departmentId: string): Promise<DeskWorkItem[]> {
  const deptSystems = await db.select({ id: systems.id }).from(systems).where(eq(systems.departmentId, departmentId));
  if (deptSystems.length === 0) return [];
  const rows = await db.query.systemTasks.findMany({
    where: and(
      inArray(
        systemTasks.systemId,
        deptSystems.map((row) => row.id),
      ),
      eq(systemTasks.archived, false),
      inArray(systemTasks.status, ["in_progress", "review", "todo"]),
    ),
    with: { system: true, phase: true },
  });
  return sortWork(rows.map(toWorkItem).filter((item) => !isSprintContainerTitle(item.title))).slice(0, 18);
}

export async function loadDeskIndex(workDate: string) {
  const snapshot = await loadAcademySnapshot(workDate);
  return snapshot;
}
