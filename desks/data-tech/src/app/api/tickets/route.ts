import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { SAFE_USER_COLUMNS } from "@/lib/safe-columns";
import { createInternalTicketSchema } from "@/lib/validation/ticket";
import { nextTicketNumber, getInternalNotifyRecipients } from "@/lib/tickets";
import { slaDueAt } from "@/lib/ticket-constants";
import { sendEmail } from "@/lib/email/send-email";
import { ticketCreatedInternalEmail } from "@/lib/email/templates/ticket-created-internal";

export async function GET(req: NextRequest) {
  const { response } = await requireModule("tickets", "view");
  if (response) return response;

  const phase = req.nextUrl.searchParams.get("phase");

  const rows = await db.query.tickets.findMany({
    where: phase ? eq(tickets.phase, phase as "unassigned" | "in_progress" | "complete") : undefined,
    orderBy: desc(tickets.createdAt),
    with: {
      department: true,
      assignees: { with: { user: { columns: SAFE_USER_COLUMNS } } },
    },
    limit: 200,
  });

  return NextResponse.json({ tickets: rows });
}

// Staff-filed tickets — e.g. "Report a problem" from a tool's page. Anyone with at least
// Tickets view access can file one, same as self-assigning is already open to any viewer.
export async function POST(req: NextRequest) {
  const { response } = await requireModule("tickets", "view");
  if (response) return response;

  const parsed = createInternalTicketSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const ticketNumber = await nextTicketNumber();
  const priority = parsed.data.priority ?? "medium";
  const [ticket] = await db
    .insert(tickets)
    .values({
      issue: parsed.data.issue,
      submitterName: parsed.data.submitterName,
      placeOfWork: parsed.data.placeOfWork,
      priority,
      departmentId: parsed.data.departmentId,
      toolId: parsed.data.toolId,
      category: parsed.data.category,
      impact: parsed.data.impact,
      campus: parsed.data.campus,
      source: "internal",
      dueAt: parsed.data.dueAt ? new Date(`${parsed.data.dueAt}T12:00:00.000Z`) : slaDueAt(priority),
      ticketNumber,
    })
    .returning();

  const internalRecipients = await getInternalNotifyRecipients();
  if (internalRecipients.length > 0) {
    const template = ticketCreatedInternalEmail(
      ticket.ticketNumber,
      ticket.issue,
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/tickets/${ticket.id}`,
    );
    await sendEmail({ to: internalRecipients, ...template }).catch(() => {});
  }

  return NextResponse.json({ ticket }, { status: 201 });
}
