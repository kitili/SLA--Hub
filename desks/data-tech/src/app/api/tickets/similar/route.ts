import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { requireModule } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const { response } = await requireModule("tickets", "view");
  if (response) return response;

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) {
    return NextResponse.json({ tickets: [] });
  }

  const results = await db
    .select({
      id: tickets.id,
      ticketNumber: tickets.ticketNumber,
      issue: tickets.issue,
      phase: tickets.phase,
      createdAt: tickets.createdAt,
      rank: sql<number>`ts_rank(${tickets.searchVector}, websearch_to_tsquery('english', ${q}))`,
    })
    .from(tickets)
    .where(sql`${tickets.searchVector} @@ websearch_to_tsquery('english', ${q})`)
    .orderBy(sql`ts_rank(${tickets.searchVector}, websearch_to_tsquery('english', ${q})) desc`)
    .limit(20);

  return NextResponse.json({ tickets: results });
}
