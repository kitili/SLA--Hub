import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { requireModulePage } from "@/lib/require-module-page";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function SimilarTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  await requireModulePage("tickets", "view");
  const query = q?.trim();

  const results =
    query && query.length >= 3
      ? await db
          .select({
            id: tickets.id,
            ticketNumber: tickets.ticketNumber,
            issue: tickets.issue,
            phase: tickets.phase,
            createdAt: tickets.createdAt,
          })
          .from(tickets)
          .where(sql`${tickets.searchVector} @@ websearch_to_tsquery('english', ${query})`)
          .orderBy(sql`ts_rank(${tickets.searchVector}, websearch_to_tsquery('english', ${query})) desc`)
          .limit(20)
      : [];

  return (
    <div>
      <h1 className="mb-6 text-xl font-medium text-navy">Search past tickets</h1>
      <form method="get" className="mb-6 flex gap-2">
        <Input name="q" defaultValue={query} placeholder="Search by keyword, e.g. 'printer offline'" />
        <Button type="submit">Search</Button>
      </form>

      {query && query.length < 3 && <p className="text-sm text-black/50">Type at least 3 characters.</p>}

      <div className="flex flex-col gap-3">
        {results.map((t) => (
          <Card key={t.id}>
            <div className="flex items-center justify-between">
              <Link href={`/dashboard/tickets/${t.id}`} className="font-medium text-navy hover:underline">
                {t.ticketNumber}
              </Link>
              <Badge tone={t.phase === "complete" ? "success" : "info"}>{t.phase.replace("_", " ")}</Badge>
            </div>
            <p className="mt-1 text-sm text-black/80">{t.issue}</p>
          </Card>
        ))}
        {query && query.length >= 3 && results.length === 0 && (
          <p className="text-sm text-black/50">No similar tickets found.</p>
        )}
      </div>
    </div>
  );
}
