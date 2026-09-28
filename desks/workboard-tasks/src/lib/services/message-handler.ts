import { startOfDay } from "date-fns";
import type { ParsedCommand } from "@/lib/whatsapp/parser";
import { parseIncomingMessage } from "@/lib/whatsapp/parser";
import {
  formatBacklogSummary,
  formatDailyPlanSummary,
  formatHelpMessage,
} from "@/lib/format/task-summary";
import { db } from "@/lib/db";
import { sendWhatsAppText } from "@/lib/whatsapp/client";
import { addTodayTask } from "@/lib/services/daily-sheet";
import { getOrCreateUserByPhone } from "@/lib/services/user";
import type { TaskStatus } from "@/generated/prisma/client";

function mapProjectStatus(status: "completed" | "in_progress" | "backlog"): TaskStatus {
  if (status === "completed") return "COMPLETED";
  if (status === "in_progress") return "IN_PROGRESS";
  return "BACKLOG";
}

async function getTodayPlan(userId: string, planDate: Date) {
  return db.dailyPlan.findUnique({
    where: {
      userId_planDate: { userId, planDate },
    },
    include: { items: true },
  });
}

async function handleDaily(userId: string, _organizationId: string, tasks: string[]) {
  const planDate = startOfDay(new Date());
  for (const title of tasks) {
    await addTodayTask(userId, { title, priority: null });
  }

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const refreshed = await getTodayPlan(userId, planDate);
  if (!refreshed) {
    throw new Error("Failed to load daily plan after submission");
  }

  return formatDailyPlanSummary(user, planDate, refreshed.items);
}

async function updateDailySlots(
  userId: string,
  slots: number[],
  status: TaskStatus,
  blockerNote?: string,
) {
  const planDate = startOfDay(new Date());
  const plan = await getTodayPlan(userId, planDate);

  if (!plan) {
    return "No daily plan for today. Send `daily:` with your 5 tasks first.";
  }

  const items = plan.items.filter((item) => slots.includes(item.slot));
  if (items.length === 0) {
    return "No matching slots found. Use numbers 1–5.";
  }

  for (const item of items) {
    await db.dailyPlanItem.update({
      where: { id: item.id },
      data: {
        status,
        blockerNote: status === "BLOCKED" ? blockerNote ?? item.blockerNote : null,
        completedAt: status === "COMPLETED" ? new Date() : null,
      },
    });

    if (item.taskId) {
      await db.task.update({
        where: { id: item.taskId },
        data: {
          status,
          blockerNote: status === "BLOCKED" ? blockerNote ?? undefined : null,
          completedAt: status === "COMPLETED" ? new Date() : null,
        },
      });

      await db.taskActivity.create({
        data: {
          taskId: item.taskId,
          userId,
          type: status === "COMPLETED" ? "DAILY_COMPLETED" : "STATUS_CHANGED",
          fromStatus: item.status,
          toStatus: status,
          message: blockerNote,
        },
      });
    }
  }

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const refreshed = await getTodayPlan(userId, planDate);
  if (!refreshed) {
    throw new Error("Failed to refresh daily plan");
  }

  return formatDailyPlanSummary(user, planDate, refreshed.items);
}

async function handleBacklogAdd(userId: string, organizationId: string, title: string) {
  const task = await db.task.create({
    data: {
      organizationId,
      assigneeId: userId,
      title,
      status: "BACKLOG",
      source: "BACKLOG",
    },
  });

  await db.taskActivity.create({
    data: {
      taskId: task.id,
      userId,
      type: "CREATED",
      toStatus: "BACKLOG",
      message: "Added via WhatsApp backlog command",
    },
  });

  return `📥 Backlog item added:\n"${title}"`;
}

async function handleBacklogList(userId: string, organizationId: string) {
  const tasks = await db.task.findMany({
    where: {
      organizationId,
      assigneeId: userId,
      status: "BACKLOG",
      source: "BACKLOG",
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return formatBacklogSummary(tasks);
}

async function handleStatus(userId: string) {
  const planDate = startOfDay(new Date());
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const plan = await getTodayPlan(userId, planDate);

  if (!plan) {
    return "No daily plan yet today.\nSend:\n`daily task1 | task2 | task3 | task4 | task5`";
  }

  return formatDailyPlanSummary(user, planDate, plan.items);
}

async function handleProjectUpdate(
  userId: string,
  organizationId: string,
  projectName: string,
  title: string,
  status: "completed" | "in_progress" | "backlog",
) {
  const project = await db.project.findFirst({
    where: {
      organizationId,
      name: { equals: projectName, mode: "insensitive" },
    },
  });

  if (!project) {
    return `Project "${projectName}" not found. Ask admin to create it in the dashboard.`;
  }

  const mappedStatus = mapProjectStatus(status);

  const existing = await db.task.findFirst({
    where: {
      organizationId,
      projectId: project.id,
      assigneeId: userId,
      title: { equals: title, mode: "insensitive" },
    },
  });

  const task =
    existing ??
    (await db.task.create({
      data: {
        organizationId,
        projectId: project.id,
        assigneeId: userId,
        title,
        status: mappedStatus,
        source: "PROJECT",
        completedAt: mappedStatus === "COMPLETED" ? new Date() : null,
      },
    }));

  if (existing) {
    await db.task.update({
      where: { id: existing.id },
      data: {
        status: mappedStatus,
        completedAt: mappedStatus === "COMPLETED" ? new Date() : null,
      },
    });

    await db.taskActivity.create({
      data: {
        taskId: existing.id,
        userId,
        type: "STATUS_CHANGED",
        fromStatus: existing.status,
        toStatus: mappedStatus,
        message: "Updated via WhatsApp project command",
      },
    });
  } else {
    await db.taskActivity.create({
      data: {
        taskId: task.id,
        userId,
        type: "CREATED",
        toStatus: mappedStatus,
        message: "Created via WhatsApp project update",
      },
    });
  }

  return `✅ Project *${project.name}*\n"${title}" → ${mappedStatus.replace("_", " ").toLowerCase()}`;
}

async function executeCommand(
  userId: string,
  organizationId: string,
  command: ParsedCommand,
): Promise<string> {
  switch (command.type) {
    case "help":
      return formatHelpMessage();
    case "daily":
      return handleDaily(userId, organizationId, command.tasks);
    case "done":
      return updateDailySlots(userId, command.slots, "COMPLETED");
    case "start":
      return updateDailySlots(userId, command.slots, "IN_PROGRESS");
    case "block":
      return updateDailySlots(userId, [command.slot], "BLOCKED", command.note);
    case "backlog_add":
      return handleBacklogAdd(userId, organizationId, command.title);
    case "backlog_list":
      return handleBacklogList(userId, organizationId);
    case "status":
      return handleStatus(userId);
    case "project_update":
      return handleProjectUpdate(
        userId,
        organizationId,
        command.project,
        command.title,
        command.status,
      );
    case "unknown":
      return [
        "I didn't understand that message.",
        "",
        formatHelpMessage(),
      ].join("\n");
  }
}

export async function processInboundWhatsAppMessage(input: {
  phone: string;
  body: string;
  waMessageId?: string;
  rawPayload?: unknown;
}): Promise<void> {
  const user = await getOrCreateUserByPhone(input.phone);
  const command = parseIncomingMessage(input.body);

  const inbound = await db.chatMessage.create({
    data: {
      userId: user.id,
      waMessageId: input.waMessageId,
      direction: "INBOUND",
      phone: user.phone,
      body: input.body,
      parsedCommand: command.type,
      rawPayload: input.rawPayload as object | undefined,
    },
  });

  try {
    const reply = await executeCommand(user.id, user.organizationId, command);
    const outboundWaId = await sendWhatsAppText({ to: user.phone, body: reply });

    await db.chatMessage.create({
      data: {
        userId: user.id,
        waMessageId: outboundWaId,
        direction: "OUTBOUND",
        phone: user.phone,
        body: reply,
        processed: true,
      },
    });

    await db.chatMessage.update({
      where: { id: inbound.id },
      data: { processed: true },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown processing error";

    await db.chatMessage.update({
      where: { id: inbound.id },
      data: {
        processed: true,
        processingError: message,
      },
    });

    throw error;
  }
}
