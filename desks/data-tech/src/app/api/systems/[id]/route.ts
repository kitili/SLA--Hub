import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { systems } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { updateSystemSchema } from "@/lib/validation/system";
import { isUniqueViolation } from "@/lib/db-errors";
import { SAFE_USER_COLUMNS } from "@/lib/safe-columns";
import { notifySystemLead } from "@/lib/systems";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireModule("systems", "view");
  if (response) return response;

  const { id } = await params;
  const system = await db.query.systems.findFirst({
    where: eq(systems.id, id),
    with: { lead: { columns: SAFE_USER_COLUMNS } },
  });
  if (!system) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ system });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireModule("systems", "manage");
  if (response) return response;

  const { id } = await params;
  const parsed = updateSystemSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [existing] = await db.select({ leadId: systems.leadId }).from(systems).where(eq(systems.id, id)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const [updated] = await db
      .update(systems)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(systems.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (updated.leadId && updated.leadId !== existing.leadId) {
      await notifySystemLead({ leadId: updated.leadId, systemId: updated.id, systemName: updated.name, description: updated.description });
    }

    return NextResponse.json({ system: updated });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "A system with this name already exists" }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireModule("systems", "manage");
  if (response) return response;

  const { id } = await params;
  const [deleted] = await db.delete(systems).where(eq(systems.id, id)).returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
