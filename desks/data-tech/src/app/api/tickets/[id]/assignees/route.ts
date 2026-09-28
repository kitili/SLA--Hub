import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tickets, ticketAssignees, users } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { hasModuleAccess } from "@/lib/modules";
import { assignTicketSchema } from "@/lib/validation/ticket";
import { updateTicketPhase, isTicketDeveloper } from "@/lib/tickets";
import { SAFE_USER_COLUMNS } from "@/lib/safe-columns";
import { sendEmail } from "@/lib/email/send-email";
import { ticketAssignedEmail } from "@/lib/email/templates/ticket-assigned";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireModule("tickets", "view");
  if (response) return response;

  const { id: ticketId } = await params;
  const parsed = assignTicketSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const isSelfAssign = parsed.data.userId === session.user.id;
  const canAssignOthers = session.user.role === "admin" || hasModuleAccess(session.user.modules, "tickets", "manage");
  if (!isSelfAssign && !canAssignOthers) {
    return NextResponse.json({ error: "Only Tickets managers can assign other users" }, { status: 403 });
  }

  if (!(await isTicketDeveloper(parsed.data.userId))) {
    return NextResponse.json({ error: "Tickets can only be assigned to the tech team" }, { status: 403 });
  }

  const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [existing] = await db
    .select()
    .from(ticketAssignees)
    .where(and(eq(ticketAssignees.ticketId, ticketId), eq(ticketAssignees.userId, parsed.data.userId)))
    .limit(1);

  if (!existing) {
    await db.insert(ticketAssignees).values({
      ticketId,
      userId: parsed.data.userId,
      assignedBy: session.user.id,
    });

    // Only notify when someone else assigns you — self-assigning ("Take ownership") is a
    // deliberate action you already know about.
    if (!isSelfAssign) {
      const [assignee] = await db.select({ email: users.email }).from(users).where(eq(users.id, parsed.data.userId)).limit(1);
      if (assignee) {
        const { subject, html } = ticketAssignedEmail({
          ticketNumber: ticket.ticketNumber,
          issue: ticket.issue,
          priority: ticket.priority,
          ticketUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/tickets/${ticket.id}`,
        });
        await sendEmail({ to: assignee.email, subject, html }).catch(() => {});
      }
    }
  }

  // A ticket moves out of "unassigned" the moment someone takes ownership of it.
  if (ticket.phase === "unassigned") {
    await updateTicketPhase({ ticketId, toPhase: "in_progress", changedBy: session.user.id });
  }

  const updated = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    with: { assignees: { with: { user: { columns: SAFE_USER_COLUMNS } } } },
  });

  return NextResponse.json({ ticket: updated }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireModule("tickets", "view");
  if (response) return response;

  const { id: ticketId } = await params;
  const parsed = assignTicketSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const isSelf = parsed.data.userId === session.user.id;
  const canAssignOthers = session.user.role === "admin" || hasModuleAccess(session.user.modules, "tickets", "manage");
  if (!isSelf && !canAssignOthers) {
    return NextResponse.json({ error: "Only Tickets managers can unassign other users" }, { status: 403 });
  }

  await db
    .delete(ticketAssignees)
    .where(and(eq(ticketAssignees.ticketId, ticketId), eq(ticketAssignees.userId, parsed.data.userId)));

  return NextResponse.json({ ok: true });
}
