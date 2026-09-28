import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { departments, supportContacts } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PublicTicketForm } from "@/components/tickets/public-ticket-form";
import { Mark } from "@/components/brand/mark";

export default async function PublicTicketsPage() {
  const [depts, contacts] = await Promise.all([
    db.select().from(departments).orderBy(asc(departments.name)),
    db
      .select()
      .from(supportContacts)
      .where(eq(supportContacts.isActive, true))
      .orderBy(asc(supportContacts.sortOrder)),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10">
      <Link href="/" className="flex w-fit items-center gap-3">
        <Mark />
        <span>
          <span className="block text-sm font-medium text-navy">Silverleaf</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-navy/45">Data & Tech</span>
        </span>
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-navy/45">Support</p>
          <h1 className="mt-1 text-3xl font-medium text-navy">File a ticket</h1>
        </div>
        <Link href="/tickets/lookup">
          <Button variant="secondary">Check an existing ticket</Button>
        </Link>
      </div>

      <PublicTicketForm departments={depts} />

      {contacts.length > 0 && (
        <Card>
          <h2 className="mb-3 text-sm font-medium text-black/60">Technical support contacts</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {contacts.map((c) => (
              <li key={c.id}>
                <span className="font-medium">{c.name}</span>
                {c.title && <span className="text-black/60"> — {c.title}</span>}
                <div className="text-black/60">{[c.phone, c.email].filter(Boolean).join(" · ")}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
