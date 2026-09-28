import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ticketNotifyRecipients } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { updateTicketNotifyRecipientSchema } from "@/lib/validation/ticket";
import { isUniqueViolation } from "@/lib/db-errors";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireModule("ticket_notifications", "manage");
  if (response) return response;

  const { id } = await params;
  const parsed = updateTicketNotifyRecipientSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const [updated] = await db
      .update(ticketNotifyRecipients)
      .set({ ...parsed.data, email: parsed.data.email?.toLowerCase().trim() })
      .where(eq(ticketNotifyRecipients.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ recipient: updated });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "That email is already on the list" }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireModule("ticket_notifications", "manage");
  if (response) return response;

  const { id } = await params;
  const [deleted] = await db.delete(ticketNotifyRecipients).where(eq(ticketNotifyRecipients.id, id)).returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
