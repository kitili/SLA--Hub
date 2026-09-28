import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tickets, ticketSolutions } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { addSolutionSchema } from "@/lib/validation/ticket";
import { updateTicketPhase } from "@/lib/tickets";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireModule("tickets", "view");
  if (response) return response;

  const { id: ticketId } = await params;
  const parsed = addSolutionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [ticket] = await db.select({ id: tickets.id }).from(tickets).where(eq(tickets.id, ticketId)).limit(1);
  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [solution] = await db
    .insert(ticketSolutions)
    .values({
      ticketId,
      authorId: session.user.id,
      body: parsed.data.body,
      isSolution: parsed.data.isSolution ?? false,
    })
    .returning();

  if (parsed.data.isSolution) {
    await updateTicketPhase({ ticketId, toPhase: "complete", changedBy: session.user.id });
  }

  return NextResponse.json({ solution }, { status: 201 });
}
