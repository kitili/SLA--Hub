import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  systemTaskAttachments,
  systemTaskChecklistItems,
  systemTaskChecklists,
  systemTaskComments,
  systemTaskDependencies,
  systemTaskTagLinks,
  systemTaskTags,
  systemTaskTimeEntries,
  systemTaskWatchers,
  systemTasks,
} from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { taskExtrasSchema } from "@/lib/validation/system";
import { getSystemAndPermissions } from "@/lib/systems";
import { loadSystemTags, loadTaskDetail, logTaskActivity, nextTagColor, replaceTaskAssignees } from "@/lib/task-workspace";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { session, response } = await requireModule("systems", "view");
  if (response) return response;

  const { taskId } = await params;
  const [existingTask] = await db.select().from(systemTasks).where(eq(systemTasks.id, taskId)).limit(1);
  if (!existingTask) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { system, permissions } = await getSystemAndPermissions(existingTask.systemId, session.user);
  if (!system) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = taskExtrasSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const op = parsed.data;
  const needsEdit = op.op !== "add_comment" && op.op !== "set_watchers";
  if (needsEdit && !permissions.canEditTask) {
    return NextResponse.json({ error: "You cannot edit this task" }, { status: 403 });
  }
  if (op.op === "set_assignees" && !permissions.canAssignTask) {
    return NextResponse.json({ error: "You cannot assign this task" }, { status: 403 });
  }

  switch (op.op) {
    case "add_comment":
      await db.insert(systemTaskComments).values({ taskId, authorId: session.user.id, body: op.body });
      await logTaskActivity(taskId, session.user.id, "commented");
      break;
    case "delete_comment":
      await db.delete(systemTaskComments).where(eq(systemTaskComments.id, op.commentId));
      break;
    case "add_checklist": {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(systemTaskChecklists)
        .where(eq(systemTaskChecklists.taskId, taskId));
      await db.insert(systemTaskChecklists).values({ taskId, title: op.title, position: count });
      await logTaskActivity(taskId, session.user.id, "checklist", op.title);
      break;
    }
    case "rename_checklist":
      await db
        .update(systemTaskChecklists)
        .set({ title: op.title })
        .where(eq(systemTaskChecklists.id, op.checklistId));
      break;
    case "delete_checklist":
      await db.delete(systemTaskChecklists).where(eq(systemTaskChecklists.id, op.checklistId));
      break;
    case "add_checklist_item": {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(systemTaskChecklistItems)
        .where(eq(systemTaskChecklistItems.checklistId, op.checklistId));
      await db
        .insert(systemTaskChecklistItems)
        .values({ checklistId: op.checklistId, title: op.title, position: count });
      break;
    }
    case "toggle_checklist_item":
      await db
        .update(systemTaskChecklistItems)
        .set({ done: op.done })
        .where(eq(systemTaskChecklistItems.id, op.itemId));
      break;
    case "delete_checklist_item":
      await db.delete(systemTaskChecklistItems).where(eq(systemTaskChecklistItems.id, op.itemId));
      break;
    case "set_assignees":
      await replaceTaskAssignees(taskId, op.userIds);
      await logTaskActivity(taskId, session.user.id, "assigned");
      break;
    case "set_watchers":
      await db.delete(systemTaskWatchers).where(eq(systemTaskWatchers.taskId, taskId));
      if (op.userIds.length) {
        await db.insert(systemTaskWatchers).values(op.userIds.map((userId) => ({ taskId, userId })));
      }
      break;
    case "add_tag": {
      const existingTags = await loadSystemTags(existingTask.systemId);
      const already = existingTags.find((t) => t.name.toLowerCase() === op.name.toLowerCase());
      const tag =
        already ??
        (
          await db
            .insert(systemTaskTags)
            .values({
              systemId: existingTask.systemId,
              name: op.name,
              color: op.color ?? nextTagColor(existingTags.length),
            })
            .returning()
        )[0];
      await db.insert(systemTaskTagLinks).values({ taskId, tagId: tag.id }).onConflictDoNothing();
      await logTaskActivity(taskId, session.user.id, "tagged", tag.name);
      break;
    }
    case "remove_tag":
      await db
        .delete(systemTaskTagLinks)
        .where(and(eq(systemTaskTagLinks.taskId, taskId), eq(systemTaskTagLinks.tagId, op.tagId)));
      break;
    case "add_dependency":
      if (op.dependsOnTaskId === taskId) {
        return NextResponse.json({ error: "A task cannot depend on itself" }, { status: 400 });
      }
      await db
        .insert(systemTaskDependencies)
        .values({ taskId, dependsOnTaskId: op.dependsOnTaskId })
        .onConflictDoNothing();
      await logTaskActivity(taskId, session.user.id, "blocked");
      break;
    case "remove_dependency":
      await db
        .delete(systemTaskDependencies)
        .where(
          and(
            eq(systemTaskDependencies.taskId, taskId),
            eq(systemTaskDependencies.dependsOnTaskId, op.dependsOnTaskId),
          ),
        );
      break;
    case "log_time":
      await db.insert(systemTaskTimeEntries).values({
        taskId,
        userId: session.user.id,
        minutes: op.minutes,
        note: op.note,
        spentOn: op.spentOn,
      });
      await logTaskActivity(taskId, session.user.id, "time", `${op.minutes}m`);
      break;
    case "delete_time":
      await db.delete(systemTaskTimeEntries).where(eq(systemTaskTimeEntries.id, op.entryId));
      break;
    case "delete_attachment":
      await db.delete(systemTaskAttachments).where(eq(systemTaskAttachments.id, op.attachmentId));
      break;
  }

  const task = await loadTaskDetail(taskId);
  return NextResponse.json({ task });
}
