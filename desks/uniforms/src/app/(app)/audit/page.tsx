import { Card, Pager, PageHeader, Table } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { pageCount, PAGE_SIZE, pageSkip, parsePage } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireUser(["STORE", "FINANCE", "CEO"]);
  const page = parsePage((await searchParams).page);
  const [events, total] = await Promise.all([
    prisma.auditEvent.findMany({ orderBy: { createdAt: "desc" }, skip: pageSkip(page), take: PAGE_SIZE }),
    prisma.auditEvent.count(),
  ]);
  return (
    <div className="grid gap-6">
      <PageHeader title="Who did what" subtitle="Receive, pay, distribute, issue, and ready-to-collect notices." />
      <Card>
        <Table headers={["When", "Who", "Action", "Ref", "Note"]}>
          {events.map((e) => (
            <tr key={e.id}>
              <td className="px-2 py-2 text-xs">{e.createdAt.toISOString().replace("T", " ").slice(0, 16)}</td>
              <td className="px-2 py-2">{e.actorName}</td>
              <td className="px-2 py-2">{e.action}</td>
              <td className="px-2 py-2">{e.ref || "—"}</td>
              <td className="px-2 py-2 text-xs text-ink-muted">{e.note}</td>
            </tr>
          ))}
        </Table>
        {events.length === 0 ? <p className="mt-3 text-sm text-ink-muted">No events yet. Pay, receive, or issue to start the log.</p> : null}
        <Pager page={page} totalPages={pageCount(total)} />
      </Card>
    </div>
  );
}
