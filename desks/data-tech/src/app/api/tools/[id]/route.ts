import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tools } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { SAFE_USER_COLUMNS } from "@/lib/safe-columns";
import { updateToolSchema } from "@/lib/validation/tool";
import { logAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/request";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireModule("tech_tools", "view");
  if (response) return response;

  const { id } = await params;

  const tool = await db.query.tools.findFirst({
    where: eq(tools.id, id),
    with: {
      category: true,
      location: true,
      conditions: { with: { recordedByUser: { columns: SAFE_USER_COLUMNS } } },
      allocations: {
        with: { allocatedToUser: { columns: SAFE_USER_COLUMNS }, allocatedToDepartment: true },
      },
    },
  });

  if (!tool) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ tool });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireModule("tech_tools", "manage");
  if (response) return response;

  const { id } = await params;
  const parsed = updateToolSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [updated] = await db
    .update(tools)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(tools.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ tool: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireModule("tech_tools", "manage");
  if (response) return response;

  const { id } = await params;

  const [tool] = await db.select().from(tools).where(eq(tools.id, id)).limit(1);
  if (!tool) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (tool.status === "allocated") {
    return NextResponse.json({ error: "Return the tool before deleting it" }, { status: 409 });
  }

  await db.delete(tools).where(eq(tools.id, id));

  await logAudit({
    actorUserId: session.user.id,
    action: "tool.delete",
    targetType: "tool",
    targetId: id,
    metadata: { assetTag: tool.assetTag, name: tool.name },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ ok: true });
}
