import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/rbac";
import { assertSprintInSystem, loadBurndown, loadCapacities, loadVelocity } from "@/lib/planning";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; sprintId: string }> }) {
  const { response } = await requireModule("systems", "view");
  if (response) return response;

  const { id: systemId, sprintId } = await params;
  const sprint = await assertSprintInSystem(sprintId, systemId);
  if (!sprint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [burndown, capacities, velocity] = await Promise.all([
    loadBurndown(sprintId),
    loadCapacities(sprintId),
    loadVelocity(systemId),
  ]);

  return NextResponse.json({ burndown, capacities, velocity });
}
