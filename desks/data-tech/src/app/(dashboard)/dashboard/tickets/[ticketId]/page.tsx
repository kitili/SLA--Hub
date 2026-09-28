import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { systems, tickets } from "@/db/schema";
import { requireModulePage } from "@/lib/require-module-page";
import { listTicketDevelopers } from "@/lib/tickets";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TicketQuickActions } from "@/components/tickets/ticket-quick-actions";
import { TicketSolutionComposer } from "@/components/tickets/ticket-solution-composer";
import { TicketConvert } from "@/components/tickets/ticket-convert";
import { TicketInternalNotes } from "@/components/tickets/ticket-internal-notes";
import { SAFE_USER_COLUMNS } from "@/lib/safe-columns";
import { TICKET_IMPACT_LABELS } from "@/lib/ticket-constants";

export default async function TicketDetailPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const { session, canManage } = await requireModulePage("tickets", "view");

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    with: {
      department: true,
      tool: true,
      linkedTask: true,
      assignees: { with: { user: { columns: SAFE_USER_COLUMNS } } },
      solutions: { with: { author: { columns: SAFE_USER_COLUMNS } } },
      attachments: true,
      statusHistory: { with: { changedByUser: { columns: SAFE_USER_COLUMNS } } },
    },
  });

  if (!ticket) notFound();

  const [staff, systemRows] = await Promise.all([
    listTicketDevelopers(),
    db.select({ id: systems.id, name: systems.name }).from(systems).orderBy(asc(systems.name)),
  ]);

  const history = [...ticket.statusHistory].sort(
    (a, b) => a.changedAt.getTime() - b.changedAt.getTime(),
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-medium text-navy">{ticket.ticketNumber}</h1>
        <Badge tone={ticket.phase === "complete" ? "success" : ticket.phase === "in_progress" ? "info" : "warning"}>
          {ticket.phase.replace("_", " ")}
        </Badge>
        <Badge tone={ticket.priority === "urgent" || ticket.priority === "high" ? "danger" : "neutral"}>
          {ticket.priority} priority
        </Badge>
        <Badge tone="neutral">{ticket.category}</Badge>
        <Badge tone="neutral">{TICKET_IMPACT_LABELS[ticket.impact]}</Badge>
        <Badge tone="neutral">{ticket.source}</Badge>
      </div>

      {session?.user && (
        <TicketQuickActions
          ticketId={ticket.id}
          currentUserId={session.user.id}
          canManageTickets={canManage}
          phase={ticket.phase}
          priority={ticket.priority}
          impact={ticket.impact}
          campus={ticket.campus}
          dueAt={ticket.dueAt ? ticket.dueAt.toISOString().slice(0, 10) : null}
          assignees={ticket.assignees.map((a) => ({ id: a.user.id, name: a.user.name }))}
          staff={staff}
        />
      )}

      <Card>
        <h2 className="mb-2 text-sm font-medium text-black/60">Issue</h2>
        <p className="whitespace-pre-wrap text-black/90">{ticket.issue}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-black/50">Name</dt>
            <dd>{ticket.submitterName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-black/50">Submitted by</dt>
            <dd>{ticket.submitterEmail ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-black/50">Phone</dt>
            <dd>{ticket.submitterPhone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-black/50">Place of work</dt>
            <dd>{ticket.placeOfWork ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-black/50">Campus / site</dt>
            <dd>{ticket.campus ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-black/50">Due</dt>
            <dd>
              {ticket.dueAt
                ? `${ticket.dueAt.toLocaleString()}${
                    ticket.phase !== "complete" && ticket.dueAt < new Date() ? " · overdue" : ""
                  }`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-black/50">Department</dt>
            <dd>{ticket.department?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-black/50">Opened</dt>
            <dd>{ticket.createdAt.toLocaleString()}</dd>
          </div>
          {ticket.tool && (
            <div>
              <dt className="text-black/50">Related device</dt>
              <dd>
                <Link href={`/dashboard/tools/${ticket.tool.id}`} className="text-navy hover:underline">
                  {ticket.tool.assetTag} — {ticket.tool.name}
                </Link>
              </dd>
            </div>
          )}
        </dl>
        {ticket.attachments.length > 0 && (
          <div className="mt-4">
            <dt className="mb-1 text-sm text-black/50">Attachment</dt>
            {ticket.attachments.map((a) => (
              <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="text-sm text-navy underline">
                {a.filename}
              </a>
            ))}
          </div>
        )}
      </Card>

      <TicketInternalNotes ticketId={ticket.id} notes={ticket.internalNotes} />

      <TicketConvert
        ticketId={ticket.id}
        systems={systemRows}
        linkedTask={
          ticket.linkedTask
            ? { id: ticket.linkedTask.id, systemId: ticket.linkedTask.systemId, title: ticket.linkedTask.title }
            : null
        }
      />

      <Card>
        <h2 className="mb-4 text-sm font-medium text-black/60">Activity &amp; solution</h2>
        <div className="flex flex-col gap-4">
          {ticket.solutions
            .slice()
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map((s) => (
              <div
                key={s.id}
                className={`rounded-md border p-3 ${s.isSolution ? "border-green-300 bg-green-50" : "border-black/10"}`}
              >
                <div className="mb-1 flex items-center justify-between text-xs text-black/50">
                  <span>{s.author.name}</span>
                  <span>{s.createdAt.toLocaleString()}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-black/90">{s.body}</p>
                {s.isSolution && (
                  <Badge tone="success" className="mt-2">
                    Solution
                  </Badge>
                )}
              </div>
            ))}
          {ticket.solutions.length === 0 && <p className="text-sm text-black/50">No activity yet.</p>}

          {session?.user && <TicketSolutionComposer ticketId={ticket.id} />}
        </div>
      </Card>

      {history.length > 0 && (
        <Card>
          <h2 className="mb-3 text-sm font-medium text-black/60">Status history</h2>
          <ol className="flex flex-col gap-2 text-sm text-black/70">
            {history.map((row) => (
              <li key={row.id}>
                {(row.fromPhase ?? "new").replace("_", " ")} → {row.toPhase.replace("_", " ")}
                {row.changedByUser ? ` · ${row.changedByUser.name}` : ""} · {row.changedAt.toLocaleString()}
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
