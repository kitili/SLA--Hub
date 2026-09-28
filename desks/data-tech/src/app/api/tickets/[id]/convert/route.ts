import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { systemTasks, tickets } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { convertTicketSchema } from "@/lib/validation/ticket";
import { getSystemAndPermissions } from "@/lib/systems";
import { logTaskActivity, nextTaskNumber, replaceTaskAssignees } from "@/lib/task-workspace";
import { assertPhaseInSystem, assertSprintInSystem } from "@/lib/planning";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireModule("tickets", "view");
  if (response) return response;

  const systemsAccess = await requireModule("systems", "view");
  if (systemsAccess.response) return systemsAccess.response;

  const { id: ticketId } = await params;
  const parsed = convertTicketSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ticket.linkedTaskId) {
    return NextResponse.json({ error: "This ticket is already linked to a task" }, { status: 409 });
  }

  const { system, permissions } = await getSystemAndPermissions(parsed.data.systemId, session.user);
  if (!system) return NextResponse.json({ error: "System not found" }, { status: 404 });
  if (!permissions.canCreateTask) {
    return NextResponse.json({ error: "You cannot add tasks on that system" }, { status: 403 });
  }

  let phaseId = parsed.data.phaseId ?? null;
  const sprintId = parsed.data.sprintId ?? null;
  if (sprintId) {
    const sprint = await assertSprintInSystem(sprintId, system.id);
    if (!sprint) return NextResponse.json({ error: "Sprint not found" }, { status: 400 });
    if (!phaseId) phaseId = sprint.phaseId;
  }
  if (phaseId && !(await assertPhaseInSystem(phaseId, system.id))) {
    return NextResponse.json({ error: "Phase not found" }, { status: 400 });
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(systemTasks)
    .where(and(eq(systemTasks.systemId, system.id), eq(systemTasks.status, "todo"), isNull(systemTasks.parentTaskId)));

  const [task] = await db
    .insert(systemTasks)
    .values({
      systemId: system.id,
      phaseId,
      sprintId,
      taskNumber: await nextTaskNumber(system.id),
      title: `${ticket.ticketNumber}: ${ticket.issue.slice(0, 180)}`,
      description: ticket.issue,
      status: "todo",
      priority: ticket.priority === "urgent" ? "urgent" : ticket.priority,
      dueDate: ticket.dueAt ? ticket.dueAt.toISOString().slice(0, 10) : null,
      position: count,
      createdBy: session.user.id,
    })
    .returning();

  await replaceTaskAssignees(task.id, [session.user.id]);
  await logTaskActivity(task.id, session.user.id, "created", `From ${ticket.ticketNumber}`);
  await db.update(tickets).set({ linkedTaskId: task.id, updatedAt: new Date() }).where(eq(tickets.id, ticket.id));

  return NextResponse.json({ task, ticketId: ticket.id }, { status: 201 });
}
