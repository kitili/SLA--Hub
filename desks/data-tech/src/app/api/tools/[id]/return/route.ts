import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { tools, toolAllocations } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/request";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireModule("tech_tools", "manage");
  if (response) return response;

  const { id: toolId } = await params;

  const [allocation] = await db
    .update(toolAllocations)
    .set({ returnedAt: new Date() })
    .where(and(eq(toolAllocations.toolId, toolId), isNull(toolAllocations.returnedAt)))
    .returning();

  if (!allocation) {
    return NextResponse.json({ error: "Tool has no active allocation" }, { status: 404 });
  }

  await db.update(tools).set({ status: "available", updatedAt: new Date() }).where(eq(tools.id, toolId));

  await logAudit({
    actorUserId: session.user.id,
    action: "tool.return",
    targetType: "tool",
    targetId: toolId,
    metadata: { allocationId: allocation.id },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ allocation });
}
