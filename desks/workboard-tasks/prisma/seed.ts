import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function createSampleTasks(
  orgId: string,
  projectId: string,
  projectKey: string,
  startCounter: number,
  tasks: Array<{
    title: string;
    status: "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED" | "BLOCKED";
    type: "TASK" | "STORY" | "BUG";
    priority: "LOW" | "MEDIUM" | "HIGH" | "HIGHEST";
    labels: string[];
    storyPoints?: number;
  }>,
) {
  let counter = startCounter;

  for (const [index, item] of tasks.entries()) {
    counter += 1;
    const taskKey = `${projectKey}-${counter}`;

    await db.task.create({
      data: {
        organizationId: orgId,
        projectId,
        taskKey,
        title: item.title,
        description: `Sample issue for ${projectKey} board demo.`,
        status: item.status,
        type: item.type,
        priority: item.priority,
        labels: item.labels,
        storyPoints: item.storyPoints,
        columnOrder: index,
        source: "MANUAL",
        completedAt: item.status === "COMPLETED" ? new Date() : null,
      },
    });
  }

  return counter;
}

async function main() {
  const org = await db.organization.upsert({
    where: { slug: "default" },
    create: { slug: "default", name: "Silverleaf Academy" },
    update: {},
  });

  const ops = await db.project.upsert({
    where: { organizationId_name: { organizationId: org.id, name: "Operations" } },
    create: {
      organizationId: org.id,
      name: "Operations",
      key: "OPS",
      description: "Internal ops, daily work, and infrastructure",
    },
    update: { key: "OPS" },
  });

  const delivery = await db.project.upsert({
    where: { organizationId_name: { organizationId: org.id, name: "Client Delivery" } },
    create: {
      organizationId: org.id,
      name: "Client Delivery",
      key: "CLD",
      description: "Client-facing deliverables and releases",
    },
    update: { key: "CLD" },
  });

  const existingOpsTasks = await db.task.count({ where: { projectId: ops.id, taskKey: { not: null } } });

  if (existingOpsTasks === 0) {
    const opsCounter = await createSampleTasks(org.id, ops.id, "OPS", 0, [
      { title: "Set up WhatsApp webhook", status: "COMPLETED", type: "TASK", priority: "HIGH", labels: ["infra"], storyPoints: 3 },
      { title: "Configure Redis worker", status: "IN_REVIEW", type: "TASK", priority: "MEDIUM", labels: ["backend"], storyPoints: 5 },
      { title: "Staff onboarding guide", status: "IN_PROGRESS", type: "STORY", priority: "MEDIUM", labels: ["docs"], storyPoints: 2 },
      { title: "EOD team digest cron", status: "TODO", type: "STORY", priority: "LOW", labels: ["automation"], storyPoints: 3 },
      { title: "Fix duplicate webhook events", status: "BACKLOG", type: "BUG", priority: "HIGHEST", labels: ["bug"], storyPoints: 1 },
    ]);

    await db.project.update({
      where: { id: ops.id },
      data: { taskCounter: opsCounter },
    });

    const cldCounter = await createSampleTasks(org.id, delivery.id, "CLD", 0, [
      { title: "Deploy staging environment", status: "IN_PROGRESS", type: "TASK", priority: "HIGH", labels: ["release"], storyPoints: 5 },
      { title: "Client sign-off on mockups", status: "BLOCKED", type: "STORY", priority: "HIGH", labels: ["client"], storyPoints: 2 },
      { title: "UAT test checklist", status: "TODO", type: "TASK", priority: "MEDIUM", labels: ["qa"], storyPoints: 3 },
      { title: "Production rollout plan", status: "BACKLOG", type: "STORY", priority: "MEDIUM", labels: ["release"], storyPoints: 5 },
    ]);

    await db.project.update({
      where: { id: delivery.id },
      data: { taskCounter: cldCounter },
    });
  }

  const staff = [
    { name: "Amina", username: "amina", phone: "254700000001" },
    { name: "Brian", username: "brian", phone: "254700000002" },
    { name: "Cynthia", username: "cynthia", phone: "254700000003" },
    { name: "David", username: "david", phone: "254700000004" },
    { name: "Maureen", username: "maureen", phone: "254700000005" },
    { name: "Paul", username: "paul", phone: "254700000006" },
    { name: "Amos", username: "amos", phone: "254700000007" },
    { name: "Francis", username: "francis", phone: "254700000008" },
  ];

  for (const person of staff) {
    await db.user.upsert({
      where: { phone: person.phone },
      create: { ...person, organizationId: org.id },
      update: { name: person.name, username: person.username, isActive: true },
    });
  }

  console.log("Seed complete:", org.name);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
