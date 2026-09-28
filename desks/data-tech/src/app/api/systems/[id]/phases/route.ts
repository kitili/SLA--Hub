import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { systemPhases } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { getSystemAndPermissions } from "@/lib/systems";
import { loadPhases, nextPhasePosition } from "@/lib/planning";
import { createPhaseSchema } from "@/lib/validation/system";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireModule("systems", "view");
  if (response) return response;
  const { id: systemId } = await params;
  return NextResponse.json({ phases: await loadPhases(systemId) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireModule("systems", "view");
  if (response) return response;

  const { id: systemId } = await params;
  const { system, permissions } = await getSystemAndPermissions(systemId, session.user);
  if (!system) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!permissions.isManagerOrLead) {
    return NextResponse.json({ error: "Only the lead or a Systems manager can add phases" }, { status: 403 });
  }

  const parsed = createPhaseSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  await db.insert(systemPhases).values({
    systemId,
    name: parsed.data.name,
    goal: parsed.data.goal,
    startDate: parsed.data.startDate,
    targetDate: parsed.data.targetDate,
    position: await nextPhasePosition(systemId),
  });

  return NextResponse.json({ phases: await loadPhases(systemId) }, { status: 201 });
}
