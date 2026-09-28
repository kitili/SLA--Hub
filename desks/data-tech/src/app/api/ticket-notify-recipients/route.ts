import { NextRequest, NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { ticketNotifyRecipients } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { createTicketNotifyRecipientSchema } from "@/lib/validation/ticket";
import { isUniqueViolation } from "@/lib/db-errors";

export async function GET() {
  const { response } = await requireModule("ticket_notifications", "view");
  if (response) return response;

  const rows = await db.select().from(ticketNotifyRecipients).orderBy(asc(ticketNotifyRecipients.email));
  return NextResponse.json({ recipients: rows });
}

export async function POST(req: NextRequest) {
  const { response } = await requireModule("ticket_notifications", "manage");
  if (response) return response;

  const parsed = createTicketNotifyRecipientSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const [recipient] = await db
      .insert(ticketNotifyRecipients)
      .values({ email: parsed.data.email.toLowerCase().trim(), name: parsed.data.name })
      .returning();

    return NextResponse.json({ recipient }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "That email is already on the list" }, { status: 409 });
    }
    throw error;
  }
}
