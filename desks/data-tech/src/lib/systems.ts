import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { systemTasks, systems, users, type taskStatusEnum } from "@/db/schema";
import { hasModuleAccess, type UserModules } from "@/lib/modules";
import { getSystemPermissions } from "@/lib/system-permissions";
import { sendEmail } from "@/lib/email/send-email";
import { taskAssignedEmail } from "@/lib/email/templates/task-assigned";
import { systemLeadAssignedEmail } from "@/lib/email/templates/system-lead-assigned";

type TaskStatus = (typeof taskStatusEnum.enumValues)[number];

export async function getSystemAndPermissions(
  systemId: string,
  sessionUser: { id: string; role: string; modules: UserModules },
) {
  const [system] = await db.select().from(systems).where(eq(systems.id, systemId)).limit(1);
  if (!system) return { system: null, permissions: null };

  const permissions = getSystemPermissions({
    isAdmin: sessionUser.role === "admin",
    canManageModule: hasModuleAccess(sessionUser.modules, "systems", "manage"),
    userId: sessionUser.id,
    leadId: system.leadId,
    state: system.state,
  });

  return { system, permissions };
}

// Awaited by callers (not fire-and-forget) — on Vercel, a serverless function's runtime can
// be frozen or torn down right after its response is sent, so an un-awaited send is not
// reliably delivered. A delivery failure is swallowed here so it never blocks the caller.
export async function notifyTaskAssignee(params: {
  assigneeId: string;
  systemId: string;
  systemName: string;
  taskTitle: string;
  priority: string;
  dueDate: string | null;
}) {
  const [assignee] = await db.select({ email: users.email }).from(users).where(eq(users.id, params.assigneeId)).limit(1);
  if (!assignee) return;

  const { subject, html } = taskAssignedEmail({
    taskTitle: params.taskTitle,
    systemName: params.systemName,
    priority: params.priority,
    dueDate: params.dueDate,
    systemUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/systems/${params.systemId}`,
  });
  await sendEmail({ to: assignee.email, subject, html }).catch(() => {});
}

// Awaited by callers, same reasoning as notifyTaskAssignee above.
export async function notifySystemLead(params: {
  leadId: string;
  systemId: string;
  systemName: string;
  description: string | null;
}) {
  const [lead] = await db.select({ email: users.email }).from(users).where(eq(users.id, params.leadId)).limit(1);
  if (!lead) return;

  const { subject, html } = systemLeadAssignedEmail({
    systemName: params.systemName,
    description: params.description,
    systemUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/systems/${params.systemId}`,
  });
  await sendEmail({ to: lead.email, subject, html }).catch(() => {});
}

// Re-sequences whichever column(s) are affected by a drag-and-drop move, rather than using
// gapped/fractional position keys — simple to reason about at the scale a single board runs at.
export async function moveTask(params: { taskId: string; toStatus: TaskStatus; toIndex: number }) {
  return db.transaction(async (tx) => {
    const [task] = await tx.select().from(systemTasks).where(eq(systemTasks.id, params.taskId)).limit(1);
    if (!task) return null;

    const fromStatus = task.status;

    const sameParent = task.parentTaskId
      ? eq(systemTasks.parentTaskId, task.parentTaskId)
      : isNull(systemTasks.parentTaskId);

    const targetColumn = await tx
      .select({ id: systemTasks.id })
      .from(systemTasks)
      .where(
        and(
          eq(systemTasks.systemId, task.systemId),
          eq(systemTasks.status, params.toStatus),
          eq(systemTasks.archived, false),
          sameParent,
          ne(systemTasks.id, params.taskId),
        ),
      )
      .orderBy(asc(systemTasks.position));

    const ids = targetColumn.map((t) => t.id);
    const clampedIndex = Math.min(Math.max(params.toIndex, 0), ids.length);
    ids.splice(clampedIndex, 0, params.taskId);

    for (let i = 0; i < ids.length; i++) {
      await tx
        .update(systemTasks)
        .set({
          position: i,
          ...(ids[i] === params.taskId ? { status: params.toStatus, updatedAt: new Date() } : {}),
        })
        .where(eq(systemTasks.id, ids[i]));
    }

    if (fromStatus !== params.toStatus) {
      const sourceColumn = await tx
        .select({ id: systemTasks.id })
        .from(systemTasks)
        .where(
          and(eq(systemTasks.systemId, task.systemId), eq(systemTasks.status, fromStatus), sameParent),
        )
        .orderBy(asc(systemTasks.position));

      for (let i = 0; i < sourceColumn.length; i++) {
        await tx.update(systemTasks).set({ position: i }).where(eq(systemTasks.id, sourceColumn[i].id));
      }
    }

    return true;
  });
}
