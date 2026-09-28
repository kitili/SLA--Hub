import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { supportContacts } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { updateSupportContactSchema } from "@/lib/validation/user";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireModule("support_contacts", "manage");
  if (response) return response;

  const { id } = await params;
  const parsed = updateSupportContactSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [updated] = await db
    .update(supportContacts)
    .set(parsed.data)
    .where(eq(supportContacts.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ contact: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireModule("support_contacts", "manage");
  if (response) return response;

  const { id } = await params;
  const [deleted] = await db.delete(supportContacts).where(eq(supportContacts.id, id)).returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
