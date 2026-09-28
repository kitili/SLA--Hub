import Link from "next/link";
import { Card, Money, PageHeader, Table } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function StockValuePage() {
  await requireUser(["STORE", "FINANCE", "CEO"]);
  const balances = await prisma.stockBalance.findMany({
    where: { qty: { gt: 0 } },
    include: { location: true, sku: true },
    orderBy: [{ location: { code: "asc" } }, { sku: { code: "asc" } }, { size: "asc" }],
  });
  const total = balances.reduce((sum, row) => sum + row.qty * row.sku.sellTzs, 0);
  const locations = balances.reduce<typeof balances[number][][]>((groups, row) => {
    const group = groups.find((rows) => rows[0]?.locationId === row.locationId);
    if (group) group.push(row);
    else groups.push([row]);
    return groups;
  }, []);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Leadership"
        title="Current stock value"
        subtitle="Selling price multiplied by quantity on hand, across every location."
        actions={<Link className="rounded-[10px] border border-card-border bg-white px-3.5 py-2 text-sm font-semibold text-electric-blue no-underline hover:bg-light-blue-30" href="/reports">Back to briefing</Link>}
      />
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Total current stock value</p>
            <p className="mt-1 text-3xl font-extrabold text-electric-blue"><Money amount={total} /></p>
          </div>
          <p className="text-sm text-ink-muted">{balances.length} stock lines · {balances.reduce((sum, row) => sum + row.qty, 0)} pieces</p>
        </div>
      </Card>
      <Card>
        {locations.map((rows) => {
          const locationTotal = rows.reduce((sum, row) => sum + row.qty * row.sku.sellTzs, 0);
          return (
            <div key={rows[0].locationId} className="mb-6 last:mb-0">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-card-border pb-2">
                <h2 className="font-semibold text-electric-blue">{rows[0].location.name}</h2>
                <p className="text-sm text-ink-muted">Subtotal <Money amount={locationTotal} /></p>
              </div>
              <Table headers={["SKU", "Size", "Qty", "Selling price", "Line value"]}>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-2 py-2">{row.sku.code} · {row.sku.name}</td>
                    <td className="px-2 py-2">{row.size}</td>
                    <td className="px-2 py-2 tabular-nums">{row.qty}</td>
                    <td className="px-2 py-2"><Money amount={row.sku.sellTzs} /></td>
                    <td className="px-2 py-2 font-semibold"><Money amount={row.qty * row.sku.sellTzs} /></td>
                  </tr>
                ))}
              </Table>
            </div>
          );
        })}
        {!balances.length ? <p className="pt-4 text-sm text-ink-muted">No stock currently on hand.</p> : null}
      </Card>
    </div>
  );
}