import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { systemTasks } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { moveTaskSchema } from "@/lib/validation/system";
import { moveTask, getSystemAndPermissions } from "@/lib/systems";
import { canMoveTask } from "@/lib/system-permissions";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { session, response } = await requireModule("systems", "view");
  if (response) return response;

  const { taskId } = await params;
  const [existingTask] = await db.select().from(systemTasks).where(eq(systemTasks.id, taskId)).limit(1);
  if (!existingTask) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { system, permissions } = await getSystemAndPermissions(existingTask.systemId, session.user);
  if (!system) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canMoveTask(permissions, existingTask, session.user.id)) {
    return NextResponse.json(
      { error: "This project is closed — you can only move tasks assigned to you" },
      { status: 403 },
    );
  }

  const parsed = moveTaskSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (parsed.data.status !== existingTask.status) {
    const limit =
      parsed.data.status === "in_progress"
        ? system.wipInProgress
        : parsed.data.status === "review"
          ? system.wipReview
          : null;
    if (limit != null) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(systemTasks)
        .where(
          and(
            eq(systemTasks.systemId, system.id),
            eq(systemTasks.status, parsed.data.status),
            eq(systemTasks.archived, false),
          ),
        );
      if (count >= limit) {
        return NextResponse.json(
          { error: `${parsed.data.status.replace("_", " ")} is at its WIP limit of ${limit}` },
          { status: 409 },
        );
      }
    }
  }

  const result = await moveTask({ taskId, toStatus: parsed.data.status, toIndex: parsed.data.index });
  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
