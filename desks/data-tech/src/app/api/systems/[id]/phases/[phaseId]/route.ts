import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { systemPhases } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { getSystemAndPermissions } from "@/lib/systems";
import { loadPhases } from "@/lib/planning";
import { updatePhaseSchema } from "@/lib/validation/system";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; phaseId: string }> }) {
  const { session, response } = await requireModule("systems", "view");
  if (response) return response;

  const { id: systemId, phaseId } = await params;
  const { system, permissions } = await getSystemAndPermissions(systemId, session.user);
  if (!system) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!permissions.isManagerOrLead) {
    return NextResponse.json({ error: "Only the lead or a Systems manager can edit phases" }, { status: 403 });
  }

  const parsed = updatePhaseSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const [updated] = await db
    .update(systemPhases)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(systemPhases.id, phaseId), eq(systemPhases.systemId, systemId)))
    .returning();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ phases: await loadPhases(systemId) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; phaseId: string }> }) {
  const { session, response } = await requireModule("systems", "view");
  if (response) return response;

  const { id: systemId, phaseId } = await params;
  const { system, permissions } = await getSystemAndPermissions(systemId, session.user);
  if (!system) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!permissions.isManagerOrLead) {
    return NextResponse.json({ error: "Only the lead or a Systems manager can delete phases" }, { status: 403 });
  }

  const [deleted] = await db
    .delete(systemPhases)
    .where(and(eq(systemPhases.id, phaseId), eq(systemPhases.systemId, systemId)))
    .returning();
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ phases: await loadPhases(systemId) });
}
