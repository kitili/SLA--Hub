import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { tools, toolAllocations } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { bulkAllocateToolSchema } from "@/lib/validation/tool";
import { logAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/request";

export async function POST(req: NextRequest) {
  const { session, response } = await requireModule("tech_tools", "manage");
  if (response) return response;

  const parsed = bulkAllocateToolSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const alreadyAllocated = await db
    .select({ toolId: toolAllocations.toolId })
    .from(toolAllocations)
    .where(and(inArray(toolAllocations.toolId, parsed.data.toolIds), isNull(toolAllocations.returnedAt)));

  if (alreadyAllocated.length > 0) {
    return NextResponse.json(
      { error: "Some tools are already allocated", toolIds: alreadyAllocated.map((a) => a.toolId) },
      { status: 409 },
    );
  }

  const batchId = randomUUID();
  const expectedReturnAt = parsed.data.expectedReturnAt ? new Date(parsed.data.expectedReturnAt) : undefined;

  const allocations = await db
    .insert(toolAllocations)
    .values(
      parsed.data.toolIds.map((toolId) => ({
        toolId,
        batchId,
        allocatedToPersonName: parsed.data.allocatedToPersonName,
        allocatedToDepartmentId: parsed.data.allocatedToDepartmentId,
        allocatedToLocationId: parsed.data.allocatedToLocationId,
        expectedReturnAt,
        purpose: parsed.data.purpose,
        allocatedBy: session.user.id,
        notes: parsed.data.notes,
      })),
    )
    .returning();

  await db
    .update(tools)
    .set({
      status: "allocated",
      ...(parsed.data.allocatedToLocationId ? { locationId: parsed.data.allocatedToLocationId } : {}),
      updatedAt: new Date(),
    })
    .where(inArray(tools.id, parsed.data.toolIds));

  await logAudit({
    actorUserId: session.user.id,
    action: "tool.bulk_allocate",
    targetType: "tool_batch",
    targetId: batchId,
    metadata: { toolIds: parsed.data.toolIds },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ batchId, allocations }, { status: 201 });
}
