import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { systemSprints } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { getSystemAndPermissions } from "@/lib/systems";
import { assertPhaseInSystem, defaultSprintWindow, loadSprints, nextSprintNumber } from "@/lib/planning";
import { createSprintSchema } from "@/lib/validation/system";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireModule("systems", "view");
  if (response) return response;
  const { id: systemId } = await params;
  return NextResponse.json({ sprints: await loadSprints(systemId) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireModule("systems", "view");
  if (response) return response;

  const { id: systemId } = await params;
  const { system, permissions } = await getSystemAndPermissions(systemId, session.user);
  if (!system) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!permissions.isManagerOrLead) {
    return NextResponse.json({ error: "Only the lead or a Systems manager can create sprints" }, { status: 403 });
  }

  const parsed = createSprintSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  if (parsed.data.phaseId && !(await assertPhaseInSystem(parsed.data.phaseId, systemId))) {
    return NextResponse.json({ error: "Phase not found" }, { status: 400 });
  }

  const number = await nextSprintNumber(systemId);
  const window = defaultSprintWindow();
  await db.insert(systemSprints).values({
    systemId,
    number,
    name: parsed.data.name ?? `Sprint ${number}`,
    goal: parsed.data.goal,
    phaseId: parsed.data.phaseId,
    startDate: parsed.data.startDate ?? window.startDate,
    endDate: parsed.data.endDate ?? window.endDate,
    status: "planned",
  });

  return NextResponse.json({ sprints: await loadSprints(systemId) }, { status: 201 });
}
