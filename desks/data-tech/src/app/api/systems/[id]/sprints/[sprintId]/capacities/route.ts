import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sprintCapacities } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { getSystemAndPermissions } from "@/lib/systems";
import { assertSprintInSystem, loadCapacities } from "@/lib/planning";
import { upsertCapacitiesSchema } from "@/lib/validation/system";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; sprintId: string }> }) {
  const { session, response } = await requireModule("systems", "view");
  if (response) return response;

  const { id: systemId, sprintId } = await params;
  const { system, permissions } = await getSystemAndPermissions(systemId, session.user);
  if (!system) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!permissions.isManagerOrLead) {
    return NextResponse.json({ error: "Only the lead or a Systems manager can set capacity" }, { status: 403 });
  }
  if (!(await assertSprintInSystem(sprintId, systemId))) {
    return NextResponse.json({ error: "Sprint not found" }, { status: 400 });
  }

  const parsed = upsertCapacitiesSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  await db.delete(sprintCapacities).where(eq(sprintCapacities.sprintId, sprintId));
  if (parsed.data.rows.length) {
    await db.insert(sprintCapacities).values(
      parsed.data.rows.map((row) => ({
        sprintId,
        userId: row.userId,
        points: row.points,
        minutes: row.minutes,
      })),
    );
  }

  return NextResponse.json({ capacities: await loadCapacities(sprintId, system.defaultCapacityPoints ?? 8) });
}
