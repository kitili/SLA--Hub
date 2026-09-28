import bcrypt from "bcryptjs";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "./index";
import {
  users,
  toolCategories,
  departments,
  toolLocations,
  systems,
  systemTasks,
  systemTaskAssignees,
  systemPhases,
  systemSprints,
  tickets,
  ticketAssignees,
  supportContacts,
  oneToFives,
} from "./schema";
import { slaDueAt } from "../lib/ticket-constants";
import { seedProjectBoards } from "./seed-project-boards";
import { nairobiDateString } from "../lib/nairobi";
import { isWorkDay } from "../lib/one-to-fives";

const DEFAULT_CATEGORIES = [
  { name: "Laptop", icon: "laptop" },
  { name: "Desktop", icon: "desktop" },
  { name: "Phone", icon: "phone" },
  { name: "Tablet", icon: "tablet" },
  { name: "Projector", icon: "projector" },
  { name: "Camera", icon: "camera" },
  { name: "Printer", icon: "printer" },
  { name: "Other", icon: "other" },
] as const;

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env.local");
  }

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    console.log(`Admin user ${email} already exists — skipping.`);
    return existing.id;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [created] = await db
    .insert(users)
    .values({
      name: "Admin",
      email,
      passwordHash,
      role: "admin",
      mustChangePassword: false,
    })
    .returning({ id: users.id });

  console.log(`Created admin user ${email}.`);
  return created.id;
}

async function seedDefaultCategories() {
  const existing = await db.select({ name: toolCategories.name }).from(toolCategories);
  const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));
  const missing = DEFAULT_CATEGORIES.filter((c) => !existingNames.has(c.name.toLowerCase()));

  if (missing.length === 0) {
    console.log("Default tool categories already present — skipping.");
    return;
  }

  await db.insert(toolCategories).values(missing);
  console.log(`Added ${missing.length} default tool categor${missing.length === 1 ? "y" : "ies"}: ${missing.map((c) => c.name).join(", ")}.`);
}

async function seedDepartments() {
  const names = ["Academic", "Operations", "Finance", "HR", "Data & Tech", "Facilities", "Onboarding", "Uniforms", "Marketing"];
  const existing = await db.select({ name: departments.name }).from(departments);
  const have = new Set(existing.map((d) => d.name.toLowerCase()));
  const missing = names.filter((name) => !have.has(name.toLowerCase()));
  if (missing.length === 0) {
    console.log("Departments already present — skipping.");
    return;
  }
  await db.insert(departments).values(missing.map((name) => ({ name })));
  console.log(`Added departments: ${missing.join(", ")}.`);
}

async function seedLocations() {
  const names = ["Usa River", "Ngaramtoni", "Admin office", "Store"];
  const existing = await db.select({ name: toolLocations.name }).from(toolLocations);
  const have = new Set(existing.map((l) => l.name.toLowerCase()));
  const missing = names.filter((name) => !have.has(name.toLowerCase()));
  if (missing.length === 0) {
    console.log("Device locations already present — skipping.");
    return;
  }
  await db.insert(toolLocations).values(missing.map((name) => ({ name })));
  console.log(`Added device locations: ${missing.join(", ")}.`);
}

async function seedSystems(adminId: string) {
  const catalog = [
    {
      name: "Data & Tech platform",
      description: "This app — tickets, tech-tool checkout, daily 1–5s / Thursday pulse, and sister-app boards.",
      features: [
        "Ticketing",
        "Tech tools",
        "Task boards",
        "1–5s",
        "Live: https://data-and-tech.vercel.app",
        "Local: http://localhost:4050",
      ],
      techStack: ["Next.js", "Postgres"],
      url: "https://data-and-tech.vercel.app",
      status: "active" as const,
    },
    {
      name: "Google Workspace",
      description: "School email, Drive, Classroom, and account access.",
      features: ["Email", "Drive", "Classroom"],
      techStack: ["Google"],
      status: "active" as const,
    },
    {
      name: "Campus network",
      description: "Wifi, switching, and campus connectivity.",
      features: ["Wifi", "Access points", "Firewall"],
      techStack: ["Networking"],
      status: "active" as const,
    },
  ];

  const existing = await db.select({ name: systems.name }).from(systems);
  const have = new Set(existing.map((s) => s.name.toLowerCase()));
  const missing = catalog.filter((s) => !have.has(s.name.toLowerCase()));
  if (missing.length === 0) {
    console.log("Systems already present — skipping.");
  } else {
    await db.insert(systems).values(missing.map((s) => ({ ...s, leadId: adminId })));
    console.log(`Added systems: ${missing.map((s) => s.name).join(", ")}.`);
  }

  const [platform] = await db
    .select({ id: systems.id })
    .from(systems)
    .where(eq(systems.name, "Data & Tech platform"))
    .limit(1);
  if (!platform) return;

  const existingTasks = await db
    .select({ id: systemTasks.id })
    .from(systemTasks)
    .where(eq(systemTasks.systemId, platform.id))
    .limit(1);
  if (existingTasks.length > 0) {
    console.log("Starter tasks already present — skipping.");
    return;
  }

  await db.insert(systemTasks).values([
    {
      systemId: platform.id,
      taskNumber: 1,
      title: "Triage new tickets daily",
      description: "Check unassigned tickets, set priority and due date, take ownership or assign.",
      status: "todo",
      priority: "high",
      position: 0,
      createdBy: adminId,
    },
    {
      systemId: platform.id,
      taskNumber: 2,
      title: "Inventory overdue device returns",
      description: "Chase allocations past their return date.",
      status: "backlog",
      priority: "medium",
      position: 0,
      createdBy: adminId,
    },
  ]);
  console.log("Added starter tasks on Data & Tech platform.");
}

async function seedSampleTickets() {
  const existing = await db.select({ id: tickets.id }).from(tickets).limit(1);
  if (existing.length > 0) {
    console.log("Tickets already present — skipping samples.");
    return;
  }

  const [dept] = await db.select({ id: departments.id }).from(departments).where(eq(departments.name, "Data & Tech")).limit(1);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  await db.insert(tickets).values([
    {
      ticketNumber: "TCK-000001",
      issue: "Staff laptop will not connect to campus wifi after the password reset.",
      submitterName: "Amina Joseph",
      submitterEmail: "amina@silverleaf.local",
      placeOfWork: "Staff room",
      campus: "Usa River",
      category: "network",
      impact: "individual",
      source: "public",
      priority: "high",
      phase: "unassigned",
      departmentId: dept?.id,
      dueAt: slaDueAt("high"),
    },
    {
      ticketNumber: "TCK-000002",
      issue: "Projector in Form 3A has no signal from the HDMI cable.",
      submitterName: "Mr. Kimaro",
      submitterPhone: "+255700000002",
      placeOfWork: "Form 3A",
      campus: "Usa River",
      category: "hardware",
      impact: "classroom",
      source: "internal",
      priority: "medium",
      phase: "in_progress",
      dueAt: yesterday,
    },
    {
      ticketNumber: "TCK-000003",
      issue: "New teacher needs a Google Workspace account and Classroom access.",
      submitterName: "HR",
      submitterEmail: "hr@silverleaf.local",
      campus: "Ngaramtoni",
      category: "access",
      impact: "individual",
      source: "internal",
      priority: "urgent",
      phase: "unassigned",
      dueAt: slaDueAt("urgent"),
    },
  ]);
  await db.execute(sql`select setval('ticket_number_seq', 3, true)`);
  console.log("Added sample tickets TCK-000001–000003.");
}

async function seedPlanning() {
  const rows = await db.select({ id: systems.id, name: systems.name }).from(systems);
  const windowStart = new Date();
  const windowEnd = new Date();
  windowEnd.setDate(windowStart.getDate() + 13);
  const startDate = windowStart.toISOString().slice(0, 10);
  const endDate = windowEnd.toISOString().slice(0, 10);

  for (const system of rows) {
    const existing = await db
      .select({ id: systemPhases.id })
      .from(systemPhases)
      .where(eq(systemPhases.systemId, system.id))
      .limit(1);
    if (existing.length > 0) continue;

    const [phase1, phase2] = await db
      .insert(systemPhases)
      .values([
        { systemId: system.id, name: "Foundation", goal: "Stand up the core workflow.", position: 0, startDate },
        { systemId: system.id, name: "Operations", goal: "Run and improve the live process.", position: 1 },
      ])
      .returning();

    const [sprint1, sprint2] = await db
      .insert(systemSprints)
      .values([
        {
          systemId: system.id,
          phaseId: phase1.id,
          number: 1,
          name: "First delivery",
          goal: "Issue the first slice of work and finish it.",
          status: "active",
          startDate,
          endDate,
        },
        {
          systemId: system.id,
          phaseId: phase2.id,
          number: 2,
          name: "Next cycle",
          goal: "Pull leftover and new work.",
          status: "planned",
        },
      ])
      .returning();

    const tasks = await db
      .select({ id: systemTasks.id, status: systemTasks.status })
      .from(systemTasks)
      .where(eq(systemTasks.systemId, system.id));
    for (const task of tasks) {
      const inSprint = task.status !== "backlog";
      await db
        .update(systemTasks)
        .set({
          phaseId: inSprint ? phase1.id : phase2.id,
          sprintId: inSprint ? sprint1.id : null,
          updatedAt: new Date(),
        })
        .where(eq(systemTasks.id, task.id));
    }
    console.log(`Seeded phases and sprints for ${system.name} (${sprint1.name}, ${sprint2.name}).`);
  }
}

async function placeAdminOnDesk(adminId: string) {
  const [dept] = await db.select({ id: departments.id }).from(departments).where(eq(departments.name, "Data & Tech")).limit(1);
  if (!dept) return;
  await db.update(users).set({ departmentId: dept.id, updatedAt: new Date() }).where(eq(users.id, adminId));

  const deptSystems = await db.select({ id: systems.id }).from(systems).where(eq(systems.departmentId, dept.id));
  if (deptSystems.length > 0) {
    const open = await db
      .select({
        id: systemTasks.id,
        title: systemTasks.title,
        status: systemTasks.status,
        assigneeId: systemTasks.assigneeId,
      })
      .from(systemTasks)
      .where(
        and(
          inArray(
            systemTasks.systemId,
            deptSystems.map((row) => row.id),
          ),
          eq(systemTasks.archived, false),
          inArray(systemTasks.status, ["in_progress", "review", "todo"]),
        ),
      );
    const rank: Record<string, number> = { in_progress: 0, review: 1, todo: 2 };
    const live = open
      .filter((task) => !/^Sprint \d+/.test(task.title))
      .sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9))
      .slice(0, 6);
    for (const task of live) {
      await db.insert(systemTaskAssignees).values({ taskId: task.id, userId: adminId }).onConflictDoNothing();
      if (!task.assigneeId) {
        await db.update(systemTasks).set({ assigneeId: adminId, updatedAt: new Date() }).where(eq(systemTasks.id, task.id));
      }
    }
  }

  const openTickets = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(sql`${tickets.phase} <> 'complete'`)
    .limit(2);
  for (const ticket of openTickets) {
    await db.insert(ticketAssignees).values({ ticketId: ticket.id, userId: adminId, assignedBy: adminId }).onConflictDoNothing();
  }
}

async function seedTodayOneToFives() {
  const today = nairobiDateString();
  if (!(await isWorkDay(today))) {
    console.log("Not a work day — skipping sample 1–5s.");
    return;
  }

  const samples = [
    {
      email: "amina@silverleaf.local",
      slot1: "Walk a new hire through the onboarding hub journey in English and Kiswahili.",
      slot2: "Check yesterday's incomplete checkpoints with HR.",
      slot3: "Draft the Thursday pulse: wins, risks, help needed.",
    },
    {
      email: "joseph@silverleaf.local",
      slot1: "Confirm uniform stock for Usa River against the parent order queue.",
      slot2: "Follow up sewing on the size-run that is blocking distribution.",
      slot3: "Update the uniforms board sprint notes.",
    },
    {
      email: "grace@silverleaf.local",
      slot1: "Triage today's admissions leads on the marketing desk.",
      slot2: "Handoff ready families to Ed Admin.",
      slot3: "Write the weekly campus marketing snapshot.",
    },
    {
      email: "daniel@silverleaf.local",
      slot1: "Check transport boarding exceptions from this morning's QR run.",
      slot2: "Walk kitchen and facilities desks for open tickets.",
      slot3: "Close yesterday's ops 1–5s that are still in progress.",
    },
    {
      email: "mourine@silverleaf.local",
      slot1: "Triage Data & Tech tickets and move anything blocking a sister app.",
      slot2: "Update Onboarding Hub and Uniforms sprint boards.",
      slot3: "Review today's department 1–5s and leave feedback.",
    },
  ];

  let inserted = 0;
  for (const sample of samples) {
    const [person] = await db.select({ id: users.id }).from(users).where(eq(users.email, sample.email)).limit(1);
    if (!person) continue;
    const [existing] = await db
      .select({ id: oneToFives.id, submittedAt: oneToFives.submittedAt })
      .from(oneToFives)
      .where(and(eq(oneToFives.userId, person.id), eq(oneToFives.workDate, today)))
      .limit(1);
    if (existing?.submittedAt) continue;
    const values = {
      userId: person.id,
      workDate: today,
      slot1: sample.slot1,
      slot2: sample.slot2,
      slot3: sample.slot3,
      submittedAt: new Date(),
      status: "on_time" as const,
      updatedAt: new Date(),
    };
    if (existing) {
      await db.update(oneToFives).set(values).where(eq(oneToFives.id, existing.id));
    } else {
      await db.insert(oneToFives).values(values);
    }
    inserted += 1;
  }
  if (inserted) console.log(`Seeded ${inserted} department 1–5s for ${today}.`);
}

async function seedSupportContact() {
  const existing = await db.select({ id: supportContacts.id }).from(supportContacts).limit(1);
  if (existing.length > 0) {
    console.log("Support contacts already present — skipping.");
    return;
  }
  await db.insert(supportContacts).values({
    name: "Data & Tech desk",
    title: "Internal IT support",
    email: process.env.SEED_ADMIN_EMAIL ?? "kiki@silverleaf.local",
    sortOrder: 0,
  });
  console.log("Added a support contact for the public ticket page.");
}

async function main() {
  const adminId = await seedAdmin();
  await seedDefaultCategories();
  await seedDepartments();
  await seedLocations();
  await seedSupportContact();
  await seedSystems(adminId);
  await seedSampleTickets();
  await seedProjectBoards(adminId);
  await placeAdminOnDesk(adminId);
  await seedTodayOneToFives();
  try {
    await seedPlanning();
  } catch (error) {
    console.warn("Planning seed skipped (schema mismatch):", error instanceof Error ? error.message : error);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
