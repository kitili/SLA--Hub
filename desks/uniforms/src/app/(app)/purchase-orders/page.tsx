import { cancelPurchaseOrder, createPurchaseOrder, receivePurchaseOrder, sendPurchaseOrder, updatePurchaseOrder } from "@/actions/purchase";
import { createSupplier, updateSupplier } from "@/actions/suppliers";
import { ConfirmModal } from "@/components/confirm-modal";
import { LinesEditor } from "@/components/lines-editor";
import { Badge, Btn, Card, Field, Money, Pager, PageHeader, Table, inputClass, statusTone } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { pageCount, PAGE_SIZE, pageSkip, parsePage } from "@/lib/pagination";
import { ACTIVE_SKU } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireUser(["STORE", "FINANCE"]);
  const page = parsePage((await searchParams).page);
  const [pos, total, suppliers, skus] = await Promise.all([
    prisma.purchaseOrder.findMany({
      include: { supplier: true, raisedBy: true, lines: { include: { sku: true } }, expenses: true },
      orderBy: { createdAt: "desc" },
      skip: pageSkip(page),
      take: PAGE_SIZE,
    }),
    prisma.purchaseOrder.count(),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.sku.findMany({ where: ACTIVE_SKU, include: { sizes: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Purchase orders"
        subtitle="City buys land in MAIN first. Partial receive leaves the PO open. Unit cost posts as a finance expense."
      />
      {pos.map((po) => {
        const value = po.lines.reduce((s, l) => s + l.qty * l.unitTzs, 0);
        const receivedCost = po.expenses.reduce((s, e) => s + e.amountTzs, 0);
        return (
          <Card key={po.id}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{po.ref}</h2>
                <p className="text-sm text-[var(--muted)]">
                  {po.supplier.name} · raised by {po.raisedBy.name}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge tone={po.approveStatus === "APPROVED" ? "leaf" : po.approveStatus === "REJECTED" ? "red" : "gold"}>
                  {po.approveStatus === "PENDING" ? "AWAITING FINANCE" : po.approveStatus}
                </Badge>
                <Badge tone={statusTone(po.status)}>{po.status}</Badge>
              </div>
            </div>
            <Table headers={["SKU", "Size", "Qty", "Received", "Unit cost", "Line"]}>
              {po.lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-2 py-2">{line.sku.code}</td>
                  <td className="px-2 py-2">{line.size}</td>
                  <td className="px-2 py-2">{line.qty}</td>
                  <td className="px-2 py-2">{line.received}</td>
                  <td className="px-2 py-2"><Money amount={line.unitTzs} /></td>
                  <td className="px-2 py-2"><Money amount={line.qty * line.unitTzs} /></td>
                </tr>
              ))}
            </Table>
            <p className="mt-2 text-sm">
              Ordered <Money amount={value} /> · Received cost <Money amount={receivedCost} />
            </p>
            {po.status === "DRAFT" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {po.approveStatus === "APPROVED" ? (
                  <ConfirmModal
                    triggerLabel="Mark sent"
                    triggerTone="primary"
                    tone="primary"
                    title={`Mark ${po.ref} as sent?`}
                    description={`This commits the order to ${po.supplier.name} — real money is going out the door. Treat this as the point of no return with the supplier.`}
                    confirmLabel="Yes, mark it sent"
                    action={sendPurchaseOrder}
                    hiddenFields={{ poId: po.id }}
                  />
                ) : null}
                <ConfirmModal
                  triggerLabel="Edit PO"
                  triggerTone="ghost"
                  tone="primary"
                  wide
                  title={`Edit ${po.ref}`}
                  description="Change items, sizes, quantities, or unit cost. Only works while still DRAFT."
                  confirmLabel="Save changes"
                  action={updatePurchaseOrder}
                  hiddenFields={{ poId: po.id }}
                >
                  <LinesEditor
                    showCost
                    skus={skus.map((s) => ({
                      id: s.id,
                      code: s.code,
                      name: s.name,
                      sellTzs: s.sellTzs,
                      buyTzs: s.buyTzs,
                      sizes: s.sizes.map((x) => x.size),
                    }))}
                    initialRows={po.lines.map((l) => ({ skuId: l.skuId, size: l.size, qty: l.qty, unitTzs: l.unitTzs }))}
                  />
                </ConfirmModal>
                <ConfirmModal
                  triggerLabel="Cancel PO"
                  triggerTone="danger"
                  title={`Cancel ${po.ref}?`}
                  description="This draft PO will be cancelled. Nothing has been sent or received yet, so no stock or expense records are affected."
                  confirmLabel="Yes, cancel it"
                  action={cancelPurchaseOrder}
                  hiddenFields={{ poId: po.id }}
                />
              </div>
            ) : null}
            {po.status !== "DRAFT" && po.status !== "CLOSED" && po.status !== "CANCELLED" ? (
              <div className="mt-4">
                <ConfirmModal
                  triggerLabel="Receive into MAIN"
                  triggerTone="primary"
                  tone="primary"
                  wide
                  title={`Receive ${po.ref} into MAIN?`}
                  description="This both adds the quantities below to MAIN stock and records a matching expense for their cost — it's not just a status update, both really happen."
                  confirmLabel="Yes, receive it"
                  action={receivePurchaseOrder}
                  hiddenFields={{ poId: po.id, locationCode: "MAIN" }}
                >
                  <div className="grid gap-2">
                    {po.lines.map((line) => (
                      <div key={line.id} className="grid grid-cols-3 gap-2 text-sm">
                        <input type="hidden" name="lineId" value={line.id} />
                        <span>{line.sku.code} {line.size} left {line.qty - line.received}</span>
                        <input
                          className={inputClass()}
                          name="receiveQty"
                          type="number"
                          min={0}
                          max={line.qty - line.received}
                          defaultValue={line.qty - line.received}
                        />
                      </div>
                    ))}
                  </div>
                </ConfirmModal>
              </div>
            ) : null}
            {po.status === "SENT" || po.status === "PARTIAL" ? (
              <div className="mt-3">
                <ConfirmModal
                  triggerLabel="Cancel PO"
                  triggerTone="danger"
                  title={`Cancel ${po.ref}?`}
                  description={
                    po.lines.some((l) => l.received > 0)
                      ? "Writes off whatever hasn't arrived yet. What's already been received stays — this only stops counting the rest against the budget."
                      : "The supplier hasn't delivered anything yet. This writes the order off entirely — use this if they can't fulfill it or you're not paying the new price."
                  }
                  confirmLabel="Yes, cancel it"
                  action={cancelPurchaseOrder}
                  hiddenFields={{ poId: po.id }}
                />
              </div>
            ) : null}
          </Card>
        );
      })}
      <Pager page={page} totalPages={pageCount(total)} />

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Raise PO</h2>
        <form action={createPurchaseOrder} className="grid gap-3">
          <Field label="Supplier">
            <select className={inputClass()} name="supplierId">
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <LinesEditor
            showCost
            skus={skus.map((s) => ({
              id: s.id,
              code: s.code,
              name: s.name,
              sellTzs: s.sellTzs,
              buyTzs: s.buyTzs,
              sizes: s.sizes.map((x) => x.size),
            }))}
          />
          <Btn>Save draft</Btn>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Suppliers</h2>
        <ul className="mb-3 grid gap-1 text-sm">
          {suppliers.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-card-border pb-1 last:border-0">
              <span>
                {s.name}
                {s.contact ? ` · ${s.contact}` : ""}
                {s.phone ? ` · ${s.phone}` : ""}
                {s.city ? ` · ${s.city}` : ""}
              </span>
              <ConfirmModal
                triggerLabel="Edit"
                triggerTone="ghost"
                tone="primary"
                title={`Edit ${s.name}?`}
                description="Fix a wrong phone, contact person, or city. Past and open POs already raised against this supplier are unaffected."
                confirmLabel="Save changes"
                action={updateSupplier}
                hiddenFields={{ supplierId: s.id }}
              >
                <Field label="Name">
                  <input className={inputClass()} name="name" defaultValue={s.name} required />
                </Field>
                <Field label="Contact person">
                  <input className={inputClass()} name="contact" defaultValue={s.contact} />
                </Field>
                <Field label="Phone">
                  <input className={inputClass()} name="phone" defaultValue={s.phone} />
                </Field>
                <Field label="City">
                  <input className={inputClass()} name="city" defaultValue={s.city} />
                </Field>
              </ConfirmModal>
            </li>
          ))}
        </ul>
        <form action={createSupplier} className="grid gap-3">
          <Field label="Name">
            <input className={inputClass()} name="name" placeholder="e.g. Kilimanjaro Fabrics" required />
          </Field>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Contact person">
              <input className={inputClass()} name="contact" />
            </Field>
            <Field label="Phone">
              <input className={inputClass()} name="phone" placeholder="0754 000 000" />
            </Field>
            <Field label="City">
              <input className={inputClass()} name="city" defaultValue="Arusha" />
            </Field>
          </div>
          <div>
            <Btn>Add supplier</Btn>
          </div>
        </form>
      </Card>
    </div>
  );
}
