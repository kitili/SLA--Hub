import bcrypt from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./index";
import {
  departments,
  systemTaskAssignees,
  systemTaskChecklistItems,
  systemTaskChecklists,
  systemTaskComments,
  systemTaskDependencies,
  systemTaskTagLinks,
  systemTaskTags,
  systemTasks,
  systems,
  ticketAssignees,
  tickets,
  userModules,
  users,
} from "./schema";
import { nextTagColor, nextTaskNumber, replaceTaskAssignees } from "../lib/task-workspace";
import { slaDueAt } from "../lib/ticket-constants";
import { PROJECT_BOARDS, type SeedProject, type SeedSprint, type SeedTask, type SeedTicket } from "./seed-data/project-boards";
import { EXTRA_BOARDS } from "./seed-data/extra-boards";
import { DEVELOPER_TEST_TICKETS } from "./seed-data/developer-tickets";
import { ensureDataTechStaffAccess } from "../lib/user-modules";
import type { AccessLevel, ModuleKey } from "../lib/modules";

const SYSTEM_DEPARTMENT: Record<string, string> = {
  "Onboarding Hub": "Onboarding",
  "School Uniforms": "Uniforms",
  Marketing: "Marketing",
  "Marketing & Student Experience": "Marketing",
  "Operations Hub": "Operations",
  "Student Experience": "Operations",
  Expansion: "Data & Tech",
  Agentic: "Data & Tech",
  "Data & Tech platform": "Data & Tech",
  "Google Workspace": "Data & Tech",
  "Campus network": "Data & Tech",
};

async function attachSystemDepartment(systemId: string, projectName: string, deptByName: Map<string, string>) {
  const deptName = SYSTEM_DEPARTMENT[projectName];
  const departmentId = deptName ? deptByName.get(deptName) ?? null : null;
  if (!departmentId) return;
  await db.update(systems).set({ departmentId, updatedAt: new Date() }).where(eq(systems.id, systemId));
}

const DEVELOPER_KEYS = new Set(["A", "B", "C", "N"]);

const DEMO_STAFF: { key: string; name: string; email: string; department: string }[] = [
  { key: "A", name: "Mourine (Kai)", email: "mourine@silverleaf.local", department: "Data & Tech" },
  { key: "B", name: "Geoffrey (Jfree)", email: "geoffrey@silverleaf.local", department: "Data & Tech" },
  { key: "C", name: "Irene", email: "irene@silverleaf.local", department: "Data & Tech" },
  { key: "N", name: "Nehemiah", email: "nehemiah@silverleaf.local", department: "Data & Tech" },
  { key: "amos", name: "Amos", email: "amos@silverleaf.local", department: "Data & Tech" },
  { key: "product", name: "Onboarding product", email: "onboarding@silverleaf.local", department: "Onboarding" },
  { key: "hr", name: "HR onboarding", email: "hr.board@silverleaf.local", department: "HR" },
  { key: "mkt", name: "Marketing desk", email: "marketing.board@silverleaf.local", department: "Marketing" },
  { key: "se", name: "Student experience", email: "se.board@silverleaf.local", department: "Operations" },
  { key: "nurse", name: "Dispensary nurse", email: "nurse.board@silverleaf.local", department: "Operations" },
  { key: "ops", name: "Go-live ops", email: "ops.board@silverleaf.local", department: "Operations" },
  { key: "amina", name: "Amina", email: "amina@silverleaf.local", department: "Onboarding" },
  { key: "joseph", name: "Joseph", email: "joseph@silverleaf.local", department: "Uniforms" },
  { key: "grace", name: "Grace", email: "grace@silverleaf.local", department: "Marketing" },
  { key: "daniel", name: "Daniel", email: "daniel@silverleaf.local", department: "Operations" },
];

function ownerIds(child: SeedTask, staff: Map<string, string>) {
  const keys = child.owners ?? (child.owner ? [child.owner] : []);
  return keys.map((key) => staff.get(key)).filter((id): id is string => Boolean(id));
}

function completionFor(status: SeedTask["status"]) {
  if (status === "done") return 100;
  if (status === "review") return 80;
  if (status === "in_progress") return 45;
  return 0;
}

function resolvedTask(projectName: string, child: SeedTask): SeedTask {
  if (projectName === "Onboarding Hub") {
    const nehemiah = new Set([
      "ob-1",
      "ob-2",
      "ob-3",
      "ob-4",
      "ob-5",
      "ob-6",
      "ob-13",
      "ob-14",
      "ob-15",
      "ob-16",
      "ob-24",
      "ob-27",
      "ob-28",
    ]);
    return {
      ...child,
      owner: undefined,
      owners: nehemiah.has(child.key) ? ["N"] : ["A"],
      status: child.key === "ob-27" ? "done" : child.status,
    };
  }
  if (projectName === "Marketing & Student Experience" || projectName === "Marketing") {
    const studentLife = new Set(["mk-17", "mk-18", "mk-19", "mk-20", "mk-21", "mk-22", "mk-23", "mk-24"]);
    if (studentLife.has(child.key)) {
      return { ...child, owner: undefined, owners: [], archived: true, status: "backlog" };
    }
    return { ...child, owner: undefined, owners: ["A", "N"] };
  }
  if (projectName === "Data & Tech platform" || projectName === "Google Workspace" || projectName === "Campus network") {
    return { ...child, owner: undefined, owners: ["A", "N"] };
  }
  return child;
}

const DATA_TECH_LIVE_TASKS: { title: string; description: string; status: SeedTask["status"]; priority: SeedTask["priority"] }[] = [
  {
    title: "Daily 1–5s and Thursday pulse (company-wide, auto-closes 9:31 EAT)",
    description:
      "Staff file three tasks + blockers before 9:30 a.m. Nairobi. Cron closes the day at 9:31 EAT. Thursday pulse per department.",
    status: "done",
    priority: "high",
  },
  {
    title: "Tickets, tech-tools, and systems boards for sister apps",
    description:
      "This app tracks Onboarding, Uniforms, Marketing, Ops, Agentic, Expansion, and Student Experience progress.",
    status: "in_progress",
    priority: "high",
  },
];

async function ensureSprintRow(
  systemId: string,
  sprint: SeedSprint,
  adminId: string,
  staff: Map<string, string>,
  projectName: string,
) {
  const sprintTitle = `Sprint ${sprint.number} — ${sprint.name}`;
  const [existing] = await db
    .select({ id: systemTasks.id })
    .from(systemTasks)
    .where(and(eq(systemTasks.systemId, systemId), eq(systemTasks.title, sprintTitle)))
    .limit(1);
  if (existing) {
    await db
      .update(systemTasks)
      .set({
        status: sprint.status,
        completionPercentage: completionFor(sprint.status),
        updatedAt: new Date(),
      })
      .where(eq(systemTasks.id, existing.id));
    return existing.id;
  }

  const sprintAssignees = sprint.tasks.flatMap((child) => ownerIds(resolvedTask(projectName, child), staff));
  const ownerId = sprintAssignees[0] ?? null;
  const [created] = await db
    .insert(systemTasks)
    .values({
      systemId,
      taskNumber: await nextTaskNumber(systemId),
      title: sprintTitle,
      description: `${sprint.phase}. ${sprint.tasks.length} tickets in this sprint.`,
      status: sprint.status,
      priority: sprint.status === "in_progress" ? "high" : "medium",
      completionPercentage: completionFor(sprint.status),
      startDate: sprint.startDate ?? null,
      dueDate: sprint.dueDate ?? null,
      points: sprint.tasks.length,
      position: sprint.number,
      createdBy: adminId,
      assigneeId: ownerId,
    })
    .returning({ id: systemTasks.id });
  if (ownerId) await db.insert(systemTaskAssignees).values({ taskId: created!.id, userId: ownerId });
  return created!.id;
}

async function upsertSeedChild(
  systemId: string,
  parentTaskId: string,
  child: SeedTask,
  projectName: string,
  sprint: SeedSprint,
  childIndex: number,
  adminId: string,
  staff: Map<string, string>,
) {
  const resolved = resolvedTask(projectName, child);
  const [row] = await db
    .select({ id: systemTasks.id })
    .from(systemTasks)
    .where(and(eq(systemTasks.systemId, systemId), eq(systemTasks.title, resolved.title)))
    .limit(1);

  if (row) {
    await db
      .update(systemTasks)
      .set({
        status: resolved.status,
        completionPercentage: completionFor(resolved.status),
        archived: resolved.archived ?? false,
        updatedAt: new Date(),
      })
      .where(eq(systemTasks.id, row.id));
    await replaceTaskAssignees(row.id, ownerIds(resolved, staff));
    return "updated" as const;
  }

  const assigneeIds = ownerIds(resolved, staff);
  const [created] = await db
    .insert(systemTasks)
    .values({
      systemId,
      parentTaskId,
      taskNumber: await nextTaskNumber(systemId),
      title: resolved.title,
      description: resolved.description ?? (resolved.acceptance?.length ? resolved.acceptance.map((a) => `• ${a}`).join("\n") : null),
      status: resolved.status,
      priority: resolved.priority ?? "medium",
      completionPercentage: completionFor(resolved.status),
      startDate: resolved.startDate ?? sprint.startDate ?? null,
      dueDate: resolved.dueDate ?? sprint.dueDate ?? null,
      points: resolved.points ?? 2,
      timeEstimateMinutes: (resolved.points ?? 2) * 240,
      position: childIndex,
      createdBy: adminId,
      assigneeId: assigneeIds[0] ?? null,
      archived: resolved.archived ?? false,
    })
    .returning({ id: systemTasks.id });
  if (assigneeIds.length) await replaceTaskAssignees(created!.id, assigneeIds);
  if (resolved.comment) {
    await db.insert(systemTaskComments).values({ taskId: created!.id, authorId: adminId, body: resolved.comment });
  }
  return "inserted" as const;
}

async function syncExistingAllocations(adminId: string, staff: Map<string, string>) {
  const [marketing] = await db
    .select({ id: systems.id })
    .from(systems)
    .where(eq(systems.name, "Marketing & Student Experience"))
    .limit(1);
  if (marketing) {
    await db
      .update(systems)
      .set({
        name: "Marketing",
        description:
          "Admissions funnel, campus marketing, Ed Admin handoff, and go-live. Student Experience is a separate board. Agentic is the Cowork subsidiary.",
        updatedAt: new Date(),
      })
      .where(eq(systems.id, marketing.id));
  }

  const leadByName: Record<string, string | undefined> = {
    "Onboarding Hub": staff.get("A"),
    "School Uniforms": staff.get("A"),
    Marketing: staff.get("A"),
    "Operations Hub": staff.get("N"),
    Expansion: staff.get("A"),
    Agentic: staff.get("A"),
    "Data & Tech platform": staff.get("A"),
    "Google Workspace": staff.get("N"),
    "Campus network": staff.get("N"),
  };
  for (const [name, leadId] of Object.entries(leadByName)) {
    if (!leadId) continue;
    await db.update(systems).set({ leadId, updatedAt: new Date() }).where(eq(systems.name, name));
  }

  const boards: SeedProject[] = [...PROJECT_BOARDS, ...EXTRA_BOARDS].map((p) =>
    p.name === "Marketing & Student Experience" ? { ...p, name: "Marketing" } : p,
  );

  let updated = 0;
  let inserted = 0;
  for (const project of boards) {
    const [system] = await db.select({ id: systems.id }).from(systems).where(eq(systems.name, project.name)).limit(1);
    if (!system) continue;

    await db
      .update(systems)
      .set({
        description: project.description,
        features: project.features,
        techStack: project.techStack,
        url: project.url ?? null,
        status: project.status,
        startDate: project.startDate,
        targetDate: project.targetDate,
        updatedAt: new Date(),
      })
      .where(eq(systems.id, system.id));

    for (const sprint of project.sprints) {
      const sprintId = await ensureSprintRow(system.id, sprint, adminId, staff, project.name);
      for (const [childIndex, child] of sprint.tasks.entries()) {
        const result = await upsertSeedChild(system.id, sprintId, child, project.name, sprint, childIndex, adminId, staff);
        if (result === "inserted") inserted += 1;
        else updated += 1;
      }
    }
  }

  const [platform] = await db
    .select({ id: systems.id })
    .from(systems)
    .where(eq(systems.name, "Data & Tech platform"))
    .limit(1);
  if (platform) {
    await db
      .update(systems)
      .set({
        description: "This app — tickets, tech-tool checkout, daily 1–5s / Thursday pulse, and sister-app boards.",
        features: [
          "Ticketing",
          "Tech tools",
          "Task boards",
          "1–5s",
          "Live: https://data-and-tech.vercel.app",
          "Local: http://localhost:4050",
        ],
        url: "https://data-and-tech.vercel.app",
        updatedAt: new Date(),
      })
      .where(eq(systems.id, platform.id));

    for (const extra of DATA_TECH_LIVE_TASKS) {
      const [row] = await db
        .select({ id: systemTasks.id })
        .from(systemTasks)
        .where(and(eq(systemTasks.systemId, platform.id), eq(systemTasks.title, extra.title)))
        .limit(1);
      if (row) {
        await db
          .update(systemTasks)
          .set({
            status: extra.status,
            completionPercentage: completionFor(extra.status),
            updatedAt: new Date(),
          })
          .where(eq(systemTasks.id, row.id));
        updated += 1;
        continue;
      }
      await db.insert(systemTasks).values({
        systemId: platform.id,
        taskNumber: await nextTaskNumber(platform.id),
        title: extra.title,
        description: extra.description,
        status: extra.status,
        priority: extra.priority ?? "medium",
        completionPercentage: completionFor(extra.status),
        position: 0,
        createdBy: adminId,
      });
      inserted += 1;
    }
  }

  for (const name of ["Data & Tech platform", "Google Workspace", "Campus network"]) {
    const [system] = await db.select({ id: systems.id }).from(systems).where(eq(systems.name, name)).limit(1);
    if (!system) continue;
    const ids = [staff.get("A"), staff.get("N")].filter((id): id is string => Boolean(id));
    const tasks = await db.select({ id: systemTasks.id }).from(systemTasks).where(eq(systemTasks.systemId, system.id));
    for (const task of tasks) {
      await replaceTaskAssignees(task.id, ids);
      updated += 1;
    }
  }

  console.log(`Synced live board allocations (${updated} updated, ${inserted} inserted).`);
}

async function seedDemoStaff(adminId: string) {
  const password = process.env.SEED_ADMIN_PASSWORD;
  const map = new Map<string, string>([["admin", adminId]]);
  if (!password) {
    console.log("SEED_ADMIN_PASSWORD missing — assigning project tasks to admin only.");
    return map;
  }

  const deptRows = await db.select({ id: departments.id, name: departments.name }).from(departments);
  const deptByName = new Map(deptRows.map((d) => [d.name, d.id]));
  const passwordHash = await bcrypt.hash(password, 12);

  for (const person of DEMO_STAFF) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, person.email))
      .limit(1);
    const id =
      existing?.id ??
      (
        await db
          .insert(users)
          .values({
            name: person.name,
            email: person.email,
            passwordHash,
            role: "tech",
            departmentId: deptByName.get(person.department) ?? null,
            mustChangePassword: true,
          })
          .returning({ id: users.id })
      )[0]!.id;

    if (existing) {
      await db
        .update(users)
        .set({
          name: person.name,
          departmentId: deptByName.get(person.department) ?? null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id));
    }

    map.set(person.key, id);

    const isDeveloper = DEVELOPER_KEYS.has(person.key);
    const desired: { module: ModuleKey; level: AccessLevel }[] = [
      { module: "systems", level: "view" },
      { module: "tech_tools", level: "view" },
    ];
    if (person.department === "Data & Tech") desired.push({ module: "tickets", level: isDeveloper ? "manage" : "view" });
    else if (isDeveloper) desired.push({ module: "tickets", level: "manage" });
    if (!person.email.includes(".board@")) desired.push({ module: "one_to_fives", level: "view" });

    const existingModules = await db
      .select({ id: userModules.id, module: userModules.module, level: userModules.level })
      .from(userModules)
      .where(eq(userModules.userId, id));
    const byModule = new Map(existingModules.map((m) => [m.module, m]));
    for (const row of desired) {
      const have = byModule.get(row.module);
      if (!have) {
        await db.insert(userModules).values({ userId: id, module: row.module, level: row.level });
      } else if (have.level !== row.level) {
        await db
          .update(userModules)
          .set({ level: row.level, updatedAt: new Date() })
          .where(eq(userModules.id, have.id));
      }
    }
    if (!isDeveloper && person.department !== "Data & Tech") {
      const extraTickets = byModule.get("tickets");
      if (extraTickets) {
        await db.delete(userModules).where(eq(userModules.id, extraTickets.id));
      }
    }
  }

  console.log(`Demo board staff ready (${DEMO_STAFF.length} people).`);
  await grantOneToFivesCompanyWide();
  await grantDataTechDepartmentAccess();
  return map;
}

async function grantOneToFivesCompanyWide() {
  const staff = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.isActive, true));
  let granted = 0;
  for (const person of staff) {
    if (/\.board@/i.test(person.email)) continue;
    const [have] = await db
      .select({ id: userModules.id })
      .from(userModules)
      .where(and(eq(userModules.userId, person.id), eq(userModules.module, "one_to_fives")))
      .limit(1);
    if (have) continue;
    await db.insert(userModules).values({ userId: person.id, module: "one_to_fives", level: "view" });
    granted += 1;
  }
  if (granted) console.log(`Granted 1–5s view to ${granted} staff across departments.`);
}

async function grantDataTechDepartmentAccess() {
  const [dept] = await db
    .select({ id: departments.id })
    .from(departments)
    .where(eq(departments.name, "Data & Tech"))
    .limit(1);
  if (!dept) return;
  const staff = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.isActive, true), eq(users.departmentId, dept.id)));
  let granted = 0;
  for (const person of staff) {
    if (/\.board@/i.test(person.email)) continue;
    await ensureDataTechStaffAccess(db, person.id, dept.id);
    granted += 1;
  }
  if (granted) console.log(`Granted Data & Tech desk access to ${granted} people.`);
}

async function seedOneBoard(project: SeedProject, adminId: string, staff: Map<string, string>) {
  let [system] = await db.select({ id: systems.id }).from(systems).where(eq(systems.name, project.name)).limit(1);
  if (!system) {
    const [created] = await db
      .insert(systems)
      .values({
        name: project.name,
        description: project.description,
        features: project.features,
        techStack: project.techStack,
        url: project.url ?? null,
        status: project.status,
        leadId: adminId,
        state: "open",
        startDate: project.startDate,
        targetDate: project.targetDate,
      })
      .returning({ id: systems.id });
    system = created!;
    console.log(`Added system ${project.name}.`);
  } else {
    await db
      .update(systems)
      .set({
        description: project.description,
        features: project.features,
        techStack: project.techStack,
        url: project.url ?? null,
        status: project.status,
        startDate: project.startDate,
        targetDate: project.targetDate,
        updatedAt: new Date(),
      })
      .where(eq(systems.id, system.id));
  }

  const deptRows = await db.select({ id: departments.id, name: departments.name }).from(departments);
  await attachSystemDepartment(system.id, project.name, new Map(deptRows.map((d) => [d.name, d.id])));

  const existingTasks = await db
    .select({ id: systemTasks.id })
    .from(systemTasks)
    .where(eq(systemTasks.systemId, system.id))
    .limit(1);
  if (existingTasks.length > 0) {
    console.log(`${project.name} already has tasks — skipping board seed.`);
    return;
  }

  const phaseNames = [...new Set(project.sprints.map((s) => s.phase))];
  const tagNames = [...phaseNames, ...project.sprints.map((s) => `Sprint ${s.number}`)];
  const tagRows = await db
    .insert(systemTaskTags)
    .values(tagNames.map((name, i) => ({ systemId: system.id, name, color: nextTagColor(i) })))
    .returning({ id: systemTaskTags.id, name: systemTaskTags.name });
  const tagByName = new Map(tagRows.map((t) => [t.name, t.id]));

  const taskIdByKey = new Map<string, string>();
  let taskNumber = 1;

  for (const [sprintIndex, sprint] of project.sprints.entries()) {
    const sprintAssignees = sprint.tasks.flatMap((child) => ownerIds(resolvedTask(project.name, child), staff));
    const ownerId = sprintAssignees[0] ?? null;
    const [sprintTask] = await db
      .insert(systemTasks)
      .values({
        systemId: system.id,
        taskNumber: taskNumber++,
        title: `Sprint ${sprint.number} — ${sprint.name}`,
        description: `${sprint.phase}. ${sprint.tasks.length} tickets in this sprint.`,
        status: sprint.status,
        priority: sprint.status === "in_progress" ? "high" : "medium",
        completionPercentage: completionFor(sprint.status),
        startDate: sprint.startDate ?? null,
        dueDate: sprint.dueDate ?? null,
        points: sprint.tasks.length,
        position: sprintIndex,
        createdBy: adminId,
        assigneeId: ownerId,
      })
      .returning({ id: systemTasks.id });
    taskIdByKey.set(sprint.key, sprintTask!.id);
    if (ownerId) await db.insert(systemTaskAssignees).values({ taskId: sprintTask!.id, userId: ownerId });

    const sprintTagIds = [tagByName.get(sprint.phase), tagByName.get(`Sprint ${sprint.number}`)].filter(
      (id): id is string => Boolean(id),
    );
    if (sprintTagIds.length) {
      await db.insert(systemTaskTagLinks).values(sprintTagIds.map((tagId) => ({ taskId: sprintTask!.id, tagId })));
    }

    for (const [childIndex, child] of sprint.tasks.entries()) {
      const resolved = resolvedTask(project.name, child);
      const assigneeIds = ownerIds(resolved, staff);
      const assigneeId = assigneeIds[0] ?? null;
      const [row] = await db
        .insert(systemTasks)
        .values({
          systemId: system.id,
          parentTaskId: sprintTask!.id,
          taskNumber: taskNumber++,
          title: resolved.title,
          description: resolved.description ?? (resolved.acceptance?.length ? resolved.acceptance.map((a) => `• ${a}`).join("\n") : null),
          status: resolved.status,
          priority: resolved.priority ?? "medium",
          completionPercentage: completionFor(resolved.status),
          startDate: resolved.startDate ?? sprint.startDate ?? null,
          dueDate: resolved.dueDate ?? sprint.dueDate ?? null,
          points: resolved.points ?? 2,
          timeEstimateMinutes: (resolved.points ?? 2) * 240,
          position: childIndex,
          createdBy: adminId,
          assigneeId,
          archived: resolved.archived ?? false,
        })
        .returning({ id: systemTasks.id });
      taskIdByKey.set(child.key, row!.id);
      if (assigneeIds.length) await replaceTaskAssignees(row!.id, assigneeIds);
      if (sprintTagIds.length) {
        await db.insert(systemTaskTagLinks).values(sprintTagIds.map((tagId) => ({ taskId: row!.id, tagId })));
      }

      if (child.acceptance?.length) {
        const [list] = await db
          .insert(systemTaskChecklists)
          .values({ taskId: row!.id, title: "Acceptance", position: 0 })
          .returning({ id: systemTaskChecklists.id });
        await db.insert(systemTaskChecklistItems).values(
          child.acceptance.map((title, i) => ({
            checklistId: list!.id,
            title,
            done: child.status === "done",
            position: i,
          })),
        );
      }

      if (child.comment) {
        await db.insert(systemTaskComments).values({ taskId: row!.id, authorId: adminId, body: child.comment });
      }
    }
  }

  const depRows: { taskId: string; dependsOnTaskId: string }[] = [];
  for (const sprint of project.sprints) {
    for (const child of sprint.tasks) {
      const taskId = taskIdByKey.get(child.key);
      if (!taskId) continue;
      for (const dep of child.dependsOn ?? []) {
        const dependsOnTaskId = taskIdByKey.get(dep);
        if (dependsOnTaskId) depRows.push({ taskId, dependsOnTaskId });
      }
    }
  }
  if (depRows.length) await db.insert(systemTaskDependencies).values(depRows);

  const ticketDeptRows = await db.select({ id: departments.id, name: departments.name }).from(departments);
  const deptByName = new Map(ticketDeptRows.map((d) => [d.name, d.id]));

  for (const ticket of project.tickets) {
    const linkedTaskId = ticket.linkTaskKey ? (taskIdByKey.get(ticket.linkTaskKey) ?? null) : null;
    const created = await insertTicketIfMissing(ticket, {
      deptByName,
      linkedTaskId,
    });
    const ownerId = ticket.owner ? staff.get(ticket.owner) : undefined;
    if (created && ownerId) await ensureTicketAssignee(created.id, ownerId, adminId);
  }

  const workItems = project.sprints.reduce((n, s) => n + s.tasks.length, 0);
  console.log(
    `Seeded ${project.name}: ${project.sprints.length} sprints, ${workItems} tickets, ${project.tickets.length} helpdesk links.`,
  );
}

async function ensureTicketAssignee(ticketId: string, userId: string, assignedBy: string) {
  const [existing] = await db
    .select({ id: ticketAssignees.id })
    .from(ticketAssignees)
    .where(and(eq(ticketAssignees.ticketId, ticketId), eq(ticketAssignees.userId, userId)))
    .limit(1);
  if (existing) return;
  await db.insert(ticketAssignees).values({ ticketId, userId, assignedBy });
}

async function insertTicketIfMissing(
  ticket: SeedTicket,
  ctx: {
    deptByName: Map<string, string>;
    linkedTaskId: string | null;
  },
) {
  const [existing] = await db
    .select({ id: tickets.id, phase: tickets.phase, internalNotes: tickets.internalNotes })
    .from(tickets)
    .where(eq(tickets.issue, ticket.issue))
    .limit(1);
  if (existing) {
    if (ticket.internalNotes && !existing.internalNotes) {
      await db.update(tickets).set({ internalNotes: ticket.internalNotes, updatedAt: new Date() }).where(eq(tickets.id, existing.id));
    }
    return existing;
  }

  const numberRows = await db.execute<{ nextval: string }>(sql`select nextval('ticket_number_seq') as nextval`);
  const ticketNumber = `TCK-${String(numberRows[0]?.nextval ?? "0").padStart(6, "0")}`;
  const [created] = await db
    .insert(tickets)
    .values({
      ticketNumber,
      issue: ticket.issue,
      submitterName: ticket.submitterName,
      submitterEmail: ticket.submitterEmail,
      campus: ticket.campus ?? null,
      category: ticket.category,
      source: ticket.source,
      impact: ticket.impact,
      priority: ticket.priority,
      phase: ticket.phase,
      internalNotes: ticket.internalNotes ?? null,
      departmentId: ticket.department ? (ctx.deptByName.get(ticket.department) ?? null) : null,
      linkedTaskId: ctx.linkedTaskId,
      dueAt: slaDueAt(ticket.priority),
      resolvedAt: ticket.phase === "complete" ? new Date() : null,
    })
    .returning({ id: tickets.id, phase: tickets.phase, internalNotes: tickets.internalNotes });
  return created!;
}

async function taskIdForKey(key: string | undefined) {
  if (!key) return null;
  const [row] = await db
    .select({ id: systemTasks.id })
    .from(systemTasks)
    .innerJoin(systems, eq(systems.id, systemTasks.systemId))
    .where(eq(systemTasks.title, titleForTaskKey(key)))
    .limit(1);
  return row?.id ?? null;
}

function titleForTaskKey(key: string) {
  for (const project of PROJECT_BOARDS) {
    for (const sprint of project.sprints) {
      const match = sprint.tasks.find((t) => t.key === key);
      if (match) return match.title;
    }
  }
  return key;
}

async function seedDeveloperTickets(adminId: string, staff: Map<string, string>) {
  const deptRows = await db.select({ id: departments.id, name: departments.name }).from(departments);
  const deptByName = new Map(deptRows.map((d) => [d.name, d.id]));

  const sampleOwners: { issue: string; owner: string }[] = [
    { issue: "Staff laptop will not connect to campus wifi after the password reset.", owner: "B" },
    { issue: "Projector in Form 3A has no signal from the HDMI cable.", owner: "B" },
    { issue: "New teacher needs a Google Workspace account and Classroom access.", owner: "A" },
  ];

  const catalog: SeedTicket[] = [
    ...PROJECT_BOARDS.flatMap((p) => p.tickets),
    ...DEVELOPER_TEST_TICKETS,
  ];

  let assigned = 0;
  for (const ticket of catalog) {
    const linkedTaskId = await taskIdForKey(ticket.linkTaskKey);
    const row = await insertTicketIfMissing(ticket, { deptByName, linkedTaskId });
    const ownerId = ticket.owner ? staff.get(ticket.owner) : undefined;
    if (ownerId) {
      const [already] = await db
        .select({ id: ticketAssignees.id })
        .from(ticketAssignees)
        .where(and(eq(ticketAssignees.ticketId, row.id), eq(ticketAssignees.userId, ownerId)))
        .limit(1);
      if (!already) {
        await ensureTicketAssignee(row.id, ownerId, adminId);
        assigned += 1;
        if (row.phase === "unassigned") {
          await db.update(tickets).set({ phase: "in_progress", updatedAt: new Date() }).where(eq(tickets.id, row.id));
        }
      }
    }
  }

  for (const sample of sampleOwners) {
    const ownerId = staff.get(sample.owner);
    if (!ownerId) continue;
    const [row] = await db.select({ id: tickets.id, phase: tickets.phase }).from(tickets).where(eq(tickets.issue, sample.issue)).limit(1);
    if (!row) continue;
    const [already] = await db
      .select({ id: ticketAssignees.id })
      .from(ticketAssignees)
      .where(and(eq(ticketAssignees.ticketId, row.id), eq(ticketAssignees.userId, ownerId)))
      .limit(1);
    if (already) continue;
    await ensureTicketAssignee(row.id, ownerId, adminId);
    assigned += 1;
    if (row.phase === "unassigned") {
      await db.update(tickets).set({ phase: "in_progress", updatedAt: new Date() }).where(eq(tickets.id, row.id));
    }
  }

  console.log(
    `Developer ticket test cases ready — Mourine, Geoffrey, Irene, Nehemiah on the desk (${DEVELOPER_TEST_TICKETS.length} people-task cases, ${assigned} assignments).`,
  );
}

export async function seedProjectBoards(adminId: string) {
  const staff = await seedDemoStaff(adminId);
  const [legacyMarketing] = await db
    .select({ id: systems.id })
    .from(systems)
    .where(eq(systems.name, "Marketing & Student Experience"))
    .limit(1);
  if (legacyMarketing) {
    await db
      .update(systems)
      .set({
        name: "Marketing",
        description:
          "Admissions funnel, campus marketing, Ed Admin handoff, and go-live. Student Experience is a separate board. Agentic is the Cowork subsidiary.",
        updatedAt: new Date(),
      })
      .where(eq(systems.id, legacyMarketing.id));
    console.log("Renamed Marketing & Student Experience → Marketing.");
  }
  const boards: SeedProject[] = [...PROJECT_BOARDS, ...EXTRA_BOARDS].map((p) =>
    p.name === "Marketing & Student Experience" ? { ...p, name: "Marketing" } : p,
  );
  for (const project of boards) {
    await seedOneBoard(project, adminId, staff);
  }
  await syncExistingAllocations(adminId, staff);
  await seedDeveloperTickets(adminId, staff);
  const deptRows = await db.select({ id: departments.id, name: departments.name }).from(departments);
  const deptByName = new Map(deptRows.map((d) => [d.name, d.id]));
  const allSystems = await db.select({ id: systems.id, name: systems.name }).from(systems);
  for (const system of allSystems) {
    await attachSystemDepartment(system.id, system.name, deptByName);
  }
}
