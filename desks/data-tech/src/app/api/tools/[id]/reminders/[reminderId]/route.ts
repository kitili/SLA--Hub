import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { toolReminderDates } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { updateToolReminderSchema } from "@/lib/validation/tool-reminder";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ reminderId: string }> }) {
  const { response } = await requireModule("tech_tools", "manage");
  if (response) return response;

  const { reminderId } = await params;
  const parsed = updateToolReminderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [updated] = await db
    .update(toolReminderDates)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(toolReminderDates.id, reminderId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ reminder: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ reminderId: string }> }) {
  const { response } = await requireModule("tech_tools", "manage");
  if (response) return response;

  const { reminderId } = await params;
  const [deleted] = await db.delete(toolReminderDates).where(eq(toolReminderDates.id, reminderId)).returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
