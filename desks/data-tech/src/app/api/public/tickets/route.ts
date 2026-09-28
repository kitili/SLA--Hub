import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tickets, ticketAttachments } from "@/db/schema";
import { createTicketSchema } from "@/lib/validation/ticket";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { nextTicketNumber, getInternalNotifyRecipients } from "@/lib/tickets";
import { slaDueAt } from "@/lib/ticket-constants";
import { uploadTicketAttachment, UploadValidationError } from "@/lib/blob";
import { sendEmail } from "@/lib/email/send-email";
import { ticketCreatedSubmitterEmail } from "@/lib/email/templates/ticket-created-submitter";
import { ticketCreatedInternalEmail } from "@/lib/email/templates/ticket-created-internal";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(`ticket-create:${ip}`, 10, 60 * 60);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const formData = await req.formData();
  const parsed = createTicketSchema.safeParse({
    issue: formData.get("issue") ?? undefined,
    submitterName: formData.get("submitterName") || undefined,
    submitterEmail: formData.get("submitterEmail") ?? undefined,
    submitterPhone: formData.get("submitterPhone") || undefined,
    placeOfWork: formData.get("placeOfWork") || undefined,
    departmentId: formData.get("departmentId") || undefined,
    category: formData.get("category") || undefined,
    impact: formData.get("impact") || undefined,
    campus: formData.get("campus") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  const file = formData.get("attachment");
  let attachment: Awaited<ReturnType<typeof uploadTicketAttachment>> | null = null;
  if (file instanceof File && file.size > 0) {
    try {
      attachment = await uploadTicketAttachment(file);
    } catch (error) {
      if (error instanceof UploadValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  }

  const ticketNumber = await nextTicketNumber();

  const [ticket] = await db
    .insert(tickets)
    .values({
      ...parsed.data,
      ticketNumber,
      source: "public",
      dueAt: slaDueAt("medium"),
      submitterEmail: parsed.data.submitterEmail?.toLowerCase().trim(),
    })
    .returning();

  if (attachment) {
    await db.insert(ticketAttachments).values({ ticketId: ticket.id, ...attachment });
  }

  const internalRecipients = await getInternalNotifyRecipients();
  const submitterTemplate = ticketCreatedSubmitterEmail(ticket.ticketNumber);
  const internalTemplate = ticketCreatedInternalEmail(
    ticket.ticketNumber,
    ticket.issue,
    `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/tickets/${ticket.id}`,
  );

  await Promise.allSettled([
    ticket.submitterEmail ? sendEmail({ to: ticket.submitterEmail, ...submitterTemplate }) : Promise.resolve(),
    internalRecipients.length ? sendEmail({ to: internalRecipients, ...internalTemplate }) : Promise.resolve(),
  ]);

  return NextResponse.json({ ticketNumber: ticket.ticketNumber }, { status: 201 });
}
