import { adjustStock, transferToShop } from "@/actions/stock";
import { Badge, Card, Field, PageHeader, SkuSizeFields, Table, inputClass } from "@/components/ui";
import { CampusFilter } from "@/components/campus-filter";
import { ConfirmModal } from "@/components/confirm-modal";
import { requireUser } from "@/lib/auth";
import { isSchoolAdmin, schoolScope } from "@/lib/campus-scope";
import { listCampuses } from "@/lib/kpis";
import { prisma } from "@/lib/prisma";
import { locationWhere } from "@/lib/visibility";
import Link from "next/link";

export default async function StockPage() {
  const user = await requireUser(["STORE", "TAILOR", "ADMIN", "HEAD_TEACHER", "PRINCIPAL"]);
  const picked = await schoolScope(user);
  const where = locationWhere(user, picked?.id);
  const sites = isSchoolAdmin(user) ? await listCampuses() : [];
  const [balances, locations, skus] = await Promise.all([
    prisma.stockBalance.findMany({
      where: { location: where, qty: { gt: 0 } },
      include: { location: true, sku: true },
      orderBy: [{ location: { code: "asc" } }, { sku: { code: "asc" } }, { size: "asc" }],
    }),
    prisma.location.findMany({ where, orderBy: { code: "asc" } }),
    prisma.sku.findMany({ include: { sizes: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Ledger"
        title="Stock on hand"
        subtitle="Qty is unique per location + SKU + size. Rows under reorder are flagged."
        actions={
          <Link className="rounded-[10px] border border-card-border bg-white px-3 py-2 text-sm font-semibold text-electric-blue no-underline hover:bg-light-blue-30" href="/stock/moves">
            Movement history
          </Link>
        }
      />
      {isSchoolAdmin(user) ? <CampusFilter sites={sites} active={picked?.code} path="/stock" persist /> : null}
      <Card>
        <Table headers={["Location", "SKU", "Size", "Qty", "Reorder"]}>
          {balances.map((row) => {
            const low = row.qty <= row.sku.reorder;
            return (
              <tr key={row.id} className={low ? "bg-gold-15" : undefined}>
                <td className="px-2 py-2">{row.location.name}</td>
                <td className="px-2 py-2">
                  {row.sku.code} · {row.sku.name}
                </td>
                <td className="px-2 py-2">{row.size}</td>
                <td className="px-2 py-2 tabular-nums">{row.qty}</td>
                <td className="px-2 py-2">{low ? <Badge tone="gold">Low</Badge> : row.sku.reorder}</td>
              </tr>
            );
          })}
        </Table>
      </Card>

      {user.role === "STORE" ? (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Manual adjust</h2>
          <ConfirmModal
            triggerLabel="Post adjust"
            triggerTone="primary"
            tone="danger"
            wide
            title="Post this stock adjustment?"
            description="This directly changes the stock balance for the location, SKU, and size you pick — a fat-fingered quantity or reason posts immediately and affects real stock on hand. It can be reversed afterward from Stock movements if it's wrong, but double-check the quantity and reason now."
            confirmLabel="Yes, post it"
            action={adjustStock}
          >
            <div className="grid gap-3 md:grid-cols-5">
              <Field label="Location">
                <select className={inputClass()} name="locationId">
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </Field>
              <SkuSizeFields
                skus={skus.map((s) => ({ id: s.id, code: s.code, name: s.name, sizes: s.sizes.map((x) => x.size) }))}
              />
              <Field label="Qty (+/−)">
                <input className={inputClass()} name="qty" type="number" required />
              </Field>
              <Field label="Reason">
                <input className={inputClass()} name="note" required placeholder="Count correction" />
              </Field>
            </div>
          </ConfirmModal>
        </Card>
      ) : null}

      {user.role === "STORE" || user.role === "TAILOR" ? (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Transfer MAIN → Usa River shop</h2>
          <ConfirmModal
            triggerLabel="Move to shop"
            triggerTone="primary"
            tone="primary"
            title="Move this stock to the Usa River shop?"
            description="Transfers the quantity, SKU, and size you pick from MAIN to the Usa River shop right away. Nothing is lost — it's a two-sided move — but undoing it means manually transferring it back."
            confirmLabel="Yes, move it"
            action={transferToShop}
          >
            <div className="grid gap-3 md:grid-cols-4">
              <SkuSizeFields
                skus={skus.map((s) => ({ id: s.id, code: s.code, name: s.name, sizes: s.sizes.map((x) => x.size) }))}
              />
              <Field label="Qty">
                <input className={inputClass()} name="qty" type="number" min={1} required />
              </Field>
            </div>
          </ConfirmModal>
        </Card>
      ) : null}
    </div>
  );
}
