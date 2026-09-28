import { asc } from "drizzle-orm";
import { db } from "@/db";
import { departments } from "@/db/schema";
import { requireModulePage } from "@/lib/require-module-page";
import { StaffTicketForm } from "@/components/tickets/staff-ticket-form";

export default async function NewTicketPage() {
  const { session } = await requireModulePage("tickets", "view");
  const depts = await db.select().from(departments).orderBy(asc(departments.name));

  return (
    <div>
      <h1 className="mb-2 text-xl font-medium text-navy">New ticket</h1>
      <p className="mb-6 text-sm text-black/55">File work for Data & Tech — yourself or on behalf of someone else.</p>
      <StaffTicketForm departments={depts} defaultName={session.user.name ?? undefined} />
    </div>
  );
}
