import Link from "next/link";
import { requireModulePage } from "@/lib/require-module-page";
import { searchTickets } from "@/lib/tickets";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const PHASE_TONE = {
  unassigned: "warning",
  in_progress: "info",
  complete: "success",
} as const;

const PRIORITY_TONE = {
  low: "neutral",
  medium: "info",
  high: "warning",
  urgent: "danger",
} as const;

export default async function TicketsListPage({
  searchParams,
}: {
  searchParams: Promise<{
    phase?: string;
    q?: string;
    priority?: string;
    category?: string;
    impact?: string;
    source?: string;
    overdue?: string;
    mine?: string;
  }>;
}) {
  const filters = await searchParams;
  const { session } = await requireModulePage("tickets", "view");
  const rows = await searchTickets({ ...filters, userId: session.user.id });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium text-navy">Tickets</h1>
          <p className="mt-1 text-sm text-black/50">{rows.length} shown</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/tickets/similar">
            <Button variant="ghost">Search past tickets</Button>
          </Link>
          <Link href="/dashboard/tickets/new">
            <Button>New ticket</Button>
          </Link>
        </div>
      </div>

      <form method="get" className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-4 lg:grid-cols-8">
        <Input name="q" defaultValue={filters.q} placeholder="Search number, issue, person, campus…" className="md:col-span-2" />
        <Select name="phase" defaultValue={filters.phase ?? ""}>
          <option value="">All phases</option>
          <option value="unassigned">Unassigned</option>
          <option value="in_progress">In progress</option>
          <option value="complete">Complete</option>
        </Select>
        <Select name="priority" defaultValue={filters.priority ?? ""}>
          <option value="">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Normal</option>
          <option value="low">Low</option>
        </Select>
        <Select name="category" defaultValue={filters.category ?? ""}>
          <option value="">All categories</option>
          <option value="hardware">Hardware</option>
          <option value="software">Software</option>
          <option value="network">Network</option>
          <option value="access">Access</option>
          <option value="facilities">Facilities</option>
          <option value="other">Other</option>
        </Select>
        <Select name="impact" defaultValue={filters.impact ?? ""}>
          <option value="">All impact</option>
          <option value="individual">One person</option>
          <option value="classroom">Class / office</option>
          <option value="campus">Whole campus</option>
        </Select>
        <Select name="source" defaultValue={filters.source ?? ""}>
          <option value="">All sources</option>
          <option value="public">Public</option>
          <option value="internal">Internal</option>
        </Select>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-black/60">
            <input type="checkbox" name="mine" value="1" defaultChecked={filters.mine === "1"} />
            Mine
          </label>
          <label className="flex items-center gap-1.5 text-sm text-black/60">
            <input type="checkbox" name="overdue" value="1" defaultChecked={filters.overdue === "1"} />
            Overdue
          </label>
          <Button type="submit" variant="secondary">
            Filter
          </Button>
        </div>
      </form>

      <Card className="hidden overflow-x-auto p-0 md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-black/10 text-left text-black/60">
            <tr>
              <th className="px-4 py-3 font-medium">Ticket</th>
              <th className="px-4 py-3 font-medium">Issue</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Campus</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Phase</th>
              <th className="px-4 py-3 font-medium">Due</th>
              <th className="px-4 py-3 font-medium">Assignees</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((ticket) => {
              const overdue = ticket.dueAt && ticket.phase !== "complete" && ticket.dueAt < new Date();
              return (
                <tr key={ticket.id} className="border-b border-black/5 last:border-0 hover:bg-gray-light/60">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/tickets/${ticket.id}`} className="font-medium text-navy hover:underline">
                      {ticket.ticketNumber}
                    </Link>
                    <div className="text-xs text-black/40">{ticket.submitterName ?? ticket.submitterEmail ?? "—"}</div>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-black/80">{ticket.issue}</td>
                  <td className="px-4 py-3 capitalize text-black/60">{ticket.category}</td>
                  <td className="px-4 py-3 text-black/60">{ticket.campus ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={PRIORITY_TONE[ticket.priority]}>{ticket.priority}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={PHASE_TONE[ticket.phase]}>{ticket.phase.replace("_", " ")}</Badge>
                  </td>
                  <td className={`px-4 py-3 ${overdue ? "text-red-600" : "text-black/60"}`}>
                    {ticket.dueAt ? ticket.dueAt.toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-black/70">
                    {ticket.assignees.length ? ticket.assignees.map((a) => a.user.name).join(", ") : "—"}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-black/50">
                  No tickets found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((ticket) => (
          <Link key={ticket.id} href={`/dashboard/tickets/${ticket.id}`}>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium text-navy">{ticket.ticketNumber}</span>
                <Badge tone={PHASE_TONE[ticket.phase]}>{ticket.phase.replace("_", " ")}</Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-black/80">{ticket.issue}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-black/60">
                <span className="capitalize">{ticket.priority}</span>
                <span className="capitalize">{ticket.category}</span>
                <span>{ticket.assignees.map((a) => a.user.name).join(", ") || "Unassigned"}</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
