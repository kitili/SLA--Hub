import { runForecast, runYearEnd } from "@/actions/analytics";
import { Btn, Card, Money, Pager, PageHeader, Table } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { pageCount, PAGE_SIZE, pageSkip, parsePage } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser(["STORE", "FINANCE", "CEO"]);
  const page = parsePage((await searchParams).page);
  const snapshotWhere = { year: 2026 };
  const [snapshots, snapshotTotal, sewing, issues] = await Promise.all([
    prisma.yearEndSnapshot.findMany({
      where: snapshotWhere,
      include: { sku: true, campus: true },
      orderBy: [{ campusId: "asc" }, { skuId: "asc" }, { size: "asc" }],
      skip: pageSkip(page),
      take: PAGE_SIZE,
    }),
    prisma.yearEndSnapshot.count({ where: snapshotWhere }),
    prisma.sewingJob.findMany({ include: { sku: true } }),
    prisma.parentIssue.findMany({ include: { sku: true } }),
  ]);

  const sewn = sewing.reduce((s, j) => s + j.actual, 0);
  const issued = issues.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Year-end analytics"
        subtitle="Year-end freeze of issued qty, stock left, and margin. 2027 buy plan uses enrolment × pack − on-hand, not last year’s issues."
        actions={
          user.role === "CEO" ? undefined : (
          <div className="flex gap-2">
            <form action={runYearEnd}>
              <input type="hidden" name="year" value="2026" />
              <Btn>Run 2026 snapshot</Btn>
            </form>
            <form action={runForecast}>
              <input type="hidden" name="year" value="2027" />
              <Btn tone="ghost">Save 2027 buy plan</Btn>
            </form>
          </div>
          )
        }
      />
      <Card>
        <h2 className="mb-3 font-semibold">Sewing vs issued</h2>
        <p className="text-sm">
          Sewn into stock: <strong>{sewn}</strong> · Issued to parents: <strong>{issued}</strong> ·
          Difference: <strong>{sewn - issued}</strong>
        </p>
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">2026 snapshot</h2>
        <Table headers={["Campus", "SKU", "Size", "Issued", "Stock left", "Revenue", "Cost"]}>
          {snapshots.map((s) => (
            <tr key={s.id}>
              <td className="px-2 py-2">{s.campus?.name ?? "—"}</td>
              <td className="px-2 py-2">{s.sku.code}</td>
              <td className="px-2 py-2">{s.size}</td>
              <td className="px-2 py-2">{s.issuedQty}</td>
              <td className="px-2 py-2">{s.stockLeft}</td>
              <td className="px-2 py-2"><Money amount={s.revenueTzs} /></td>
              <td className="px-2 py-2"><Money amount={s.costTzs} /></td>
            </tr>
          ))}
        </Table>
        <Pager page={page} totalPages={pageCount(snapshotTotal)} />
      </Card>
    </div>
  );
}
