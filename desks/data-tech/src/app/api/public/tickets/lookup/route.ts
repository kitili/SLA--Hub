import { NextRequest, NextResponse } from "next/server";
import { desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { ticketLookupSchema } from "@/lib/validation/ticket";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(`ticket-lookup:${ip}`, 20, 15 * 60);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const parsed = ticketLookupSchema.safeParse({
    email: req.nextUrl.searchParams.get("email") ?? undefined,
    phone: req.nextUrl.searchParams.get("phone") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const email = parsed.data.email?.toLowerCase().trim();
  const phone = parsed.data.phone?.trim();

  // Exact match only, identical shape regardless of whether the email/phone has ever
  // submitted a ticket — deliberately avoids revealing anything about someone else's tickets.
  const matchConditions = [
    email ? eq(tickets.submitterEmail, email) : null,
    phone ? eq(tickets.submitterPhone, phone) : null,
  ].filter((c) => c !== null);

  const results = await db
    .select({
      id: tickets.id,
      ticketNumber: tickets.ticketNumber,
      issue: tickets.issue,
      phase: tickets.phase,
      priority: tickets.priority,
      createdAt: tickets.createdAt,
      resolvedAt: tickets.resolvedAt,
    })
    .from(tickets)
    .where(or(...matchConditions))
    .orderBy(
      // Unresolved first, then newest first within each group.
      sql`case when ${tickets.phase} = 'complete' then 1 else 0 end`,
      desc(tickets.createdAt),
    );

  return NextResponse.json({ tickets: results });
}
