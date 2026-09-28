import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import {
  updateTicketDueSchema,
  updateTicketFieldsSchema,
  updateTicketPhaseSchema,
  updateTicketPrioritySchema,
} from "@/lib/validation/ticket";
import { updateTicketPhase } from "@/lib/tickets";
import { sendEmail } from "@/lib/email/send-email";
import { ticketResolvedEmail } from "@/lib/email/templates/ticket-resolved";
import { SAFE_USER_COLUMNS } from "@/lib/safe-columns";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireModule("tickets", "view");
  if (response) return response;

  const { id } = await params;

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, id),
    with: {
      department: true,
      assignees: { with: { user: { columns: SAFE_USER_COLUMNS } } },
      solutions: { with: { author: { columns: SAFE_USER_COLUMNS } } },
      statusHistory: true,
      attachments: true,
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ticket });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireModule("tickets", "view");
  if (response) return response;

  const { id } = await params;
  const body = await req.json().catch(() => null);

  const phaseUpdate = updateTicketPhaseSchema.safeParse(body);
  if (phaseUpdate.success) {
    const result = await updateTicketPhase({
      ticketId: id,
      toPhase: phaseUpdate.data.phase,
      changedBy: session.user.id,
    });

    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (phaseUpdate.data.phase === "complete" && result.previous.phase !== "complete" && result.updated.submitterEmail) {
      const template = ticketResolvedEmail(result.updated.ticketNumber);
      // Awaited (not fire-and-forget) — Vercel can freeze/tear down the function's runtime
      // right after the response is sent, so an un-awaited send is not reliably delivered.
      await sendEmail({ to: result.updated.submitterEmail, ...template }).catch(() => {});
    }

    return NextResponse.json({ ticket: result.updated });
  }

  const priorityUpdate = updateTicketPrioritySchema.safeParse(body);
  if (priorityUpdate.success) {
    const [updated] = await db
      .update(tickets)
      .set({ priority: priorityUpdate.data.priority, updatedAt: new Date() })
      .where(eq(tickets.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ticket: updated });
  }

  const dueUpdate = updateTicketDueSchema.safeParse(body);
  if (dueUpdate.success) {
    const [updated] = await db
      .update(tickets)
      .set({
        dueAt: dueUpdate.data.dueAt ? new Date(`${dueUpdate.data.dueAt}T12:00:00.000Z`) : null,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, id))
      .returning();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ticket: updated });
  }

  const fieldsUpdate = updateTicketFieldsSchema.safeParse(body);
  if (fieldsUpdate.success) {
    const [updated] = await db
      .update(tickets)
      .set({
        ...(fieldsUpdate.data.impact !== undefined ? { impact: fieldsUpdate.data.impact } : {}),
        ...(fieldsUpdate.data.campus !== undefined ? { campus: fieldsUpdate.data.campus } : {}),
        ...(fieldsUpdate.data.internalNotes !== undefined ? { internalNotes: fieldsUpdate.data.internalNotes } : {}),
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, id))
      .returning();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ticket: updated });
  }

  return NextResponse.json({ error: "Invalid input" }, { status: 400 });
}
