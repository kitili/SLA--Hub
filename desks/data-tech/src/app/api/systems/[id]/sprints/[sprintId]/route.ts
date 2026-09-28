import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { systemSprints, systemTasks } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { getSystemAndPermissions } from "@/lib/systems";
import { assertPhaseInSystem, defaultSprintWindow, loadSprints } from "@/lib/planning";
import { updateSprintSchema } from "@/lib/validation/system";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; sprintId: string }> }) {
  const { session, response } = await requireModule("systems", "view");
  if (response) return response;

  const { id: systemId, sprintId } = await params;
  const { system, permissions } = await getSystemAndPermissions(systemId, session.user);
  if (!system) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!permissions.isManagerOrLead) {
    return NextResponse.json({ error: "Only the lead or a Systems manager can change sprints" }, { status: 403 });
  }

  const parsed = updateSprintSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const [sprint] = await db
    .select()
    .from(systemSprints)
    .where(and(eq(systemSprints.id, sprintId), eq(systemSprints.systemId, systemId)))
    .limit(1);
  if (!sprint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.phaseId && !(await assertPhaseInSystem(parsed.data.phaseId, systemId))) {
    return NextResponse.json({ error: "Phase not found" }, { status: 400 });
  }

  if (parsed.data.action === "start") {
    await db
      .update(systemSprints)
      .set({ status: "completed", updatedAt: new Date() })
      .where(and(eq(systemSprints.systemId, systemId), eq(systemSprints.status, "active"), ne(systemSprints.id, sprintId)));
    const window = defaultSprintWindow();
    await db
      .update(systemSprints)
      .set({
        status: "active",
        startDate: sprint.startDate ?? window.startDate,
        endDate: sprint.endDate ?? window.endDate,
        updatedAt: new Date(),
      })
      .where(eq(systemSprints.id, sprintId));
  } else if (parsed.data.action === "complete") {
    await db
      .update(systemSprints)
      .set({
        status: "completed",
        reviewNotes: parsed.data.reviewNotes ?? sprint.reviewNotes,
        retroWentWell: parsed.data.retroWentWell ?? sprint.retroWentWell,
        retroImprove: parsed.data.retroImprove ?? sprint.retroImprove,
        retroActions: parsed.data.retroActions ?? sprint.retroActions,
        updatedAt: new Date(),
      })
      .where(eq(systemSprints.id, sprintId));
  } else if (parsed.data.action === "return_unfinished") {
    await db
      .update(systemTasks)
      .set({ sprintId: null, updatedAt: new Date() })
      .where(and(eq(systemTasks.sprintId, sprintId), ne(systemTasks.status, "done")));
  } else {
    const { action: _action, ...fields } = parsed.data;
    await db
      .update(systemSprints)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(systemSprints.id, sprintId));
  }

  return NextResponse.json({ sprints: await loadSprints(systemId) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; sprintId: string }> }) {
  const { session, response } = await requireModule("systems", "view");
  if (response) return response;

  const { id: systemId, sprintId } = await params;
  const { system, permissions } = await getSystemAndPermissions(systemId, session.user);
  if (!system) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!permissions.isManagerOrLead) {
    return NextResponse.json({ error: "Only the lead or a Systems manager can delete sprints" }, { status: 403 });
  }

  const [deleted] = await db
    .delete(systemSprints)
    .where(and(eq(systemSprints.id, sprintId), eq(systemSprints.systemId, systemId)))
    .returning();
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ sprints: await loadSprints(systemId) });
}
