import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { tools, toolAllocations } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { allocateToolSchema } from "@/lib/validation/tool";
import { logAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/request";

export async function POST(req: NextRequest) {
  const { session, response } = await requireModule("tech_tools", "manage");
  if (response) return response;

  const parsed = allocateToolSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [activeAllocation] = await db
    .select({ id: toolAllocations.id })
    .from(toolAllocations)
    .where(and(eq(toolAllocations.toolId, parsed.data.toolId), isNull(toolAllocations.returnedAt)))
    .limit(1);

  if (activeAllocation) {
    return NextResponse.json({ error: "Tool is already allocated" }, { status: 409 });
  }

  const [allocation] = await db
    .insert(toolAllocations)
    .values({
      toolId: parsed.data.toolId,
      allocatedToPersonName: parsed.data.allocatedToPersonName,
      allocatedToDepartmentId: parsed.data.allocatedToDepartmentId,
      allocatedToLocationId: parsed.data.allocatedToLocationId,
      expectedReturnAt: parsed.data.expectedReturnAt ? new Date(parsed.data.expectedReturnAt) : undefined,
      purpose: parsed.data.purpose,
      allocatedBy: session.user.id,
      notes: parsed.data.notes,
    })
    .returning();

  // A location target also updates the tool's own "current location" for at-a-glance display.
  await db
    .update(tools)
    .set({
      status: "allocated",
      ...(parsed.data.allocatedToLocationId ? { locationId: parsed.data.allocatedToLocationId } : {}),
      updatedAt: new Date(),
    })
    .where(eq(tools.id, parsed.data.toolId));

  await logAudit({
    actorUserId: session.user.id,
    action: "tool.allocate",
    targetType: "tool",
    targetId: parsed.data.toolId,
    metadata: { allocationId: allocation.id },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ allocation }, { status: 201 });
}
