import Link from "next/link";
import { createDistribution, fulfillRequest, voidDistribution } from "@/actions/distribution";
import { createPurchaseOrder } from "@/actions/purchase";
import { createSewingJob } from "@/actions/sewing";
import { ConfirmModal } from "@/components/confirm-modal";
import { CampusFilter } from "@/components/campus-filter";
import { LinesEditor } from "@/components/lines-editor";
import { Badge, Card, Field, Pager, PageHeader, Table, inputClass } from "@/components/ui";
import { mainShortageAlerts } from "@/lib/alerts";
import { requireUser } from "@/lib/auth";
import { isSchoolAdmin, schoolScope } from "@/lib/campus-scope";
import { pageCount, PAGE_SIZE, pageSkip, parsePage } from "@/lib/pagination";
import { ACTIVE_SKU } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { distributionWhere, requestWhere } from "@/lib/visibility";

export default async function DistributionPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser(["STORE", "ADMIN", "HEAD_TEACHER", "PRINCIPAL"]);
  const page = parsePage((await searchParams).page);
  const picked = await schoolScope(user);
  const dnWhere = distributionWhere(user, picked?.id);
  const reqWhere = requestWhere(user, picked?.id);
  const [dns, dnsTotal, sources, campuses, requests, skus, mainShort, suppliers] = await Promise.all([
    prisma.distribution.findMany({
      where: dnWhere,
      include: { from: true, toCampus: true, issuer: true, lines: { include: { sku: true } } },
      orderBy: { createdAt: "desc" },
      skip: pageSkip(page),
      take: PAGE_SIZE,
    }),
    prisma.distribution.count({ where: dnWhere }),
    prisma.location.findMany({ where: { code: { in: ["MAIN", "SHOP_USA"] } } }),
    prisma.campus.findMany({ orderBy: { name: "asc" } }),
    prisma.campusRequest.findMany({
      where: { status: "OPEN", ...reqWhere },
      include: { campus: true, lines: { include: { sku: true } } },
    }),
    prisma.sku.findMany({ where: ACTIVE_SKU, include: { sizes: true }, orderBy: { code: "asc" } }),
    user.role === "STORE" ? mainShortageAlerts() : Promise.resolve([]),
    user.role === "STORE" ? prisma.supplier.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  const shortByRequest = new Map<string, typeof mainShort>();
  for (const m of mainShort) {
    shortByRequest.set(m.requestId, [...(shortByRequest.get(m.requestId) ?? []), m]);
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Distribution"
        subtitle="Only Imani posts a delivery note. MAIN (or shop) goes down; campus store goes up."
      />
      {isSchoolAdmin(user) ? <CampusFilter sites={campuses} active={picked?.code} path="/distribution" persist /> : null}
      <Card>
        <h2 className="mb-3 font-semibold">Delivery notes</h2>
        <Table headers={["DN", "From", "Campus", "Receiver", "Lines", ""]}>
          {dns.map((dn) => (
            <tr key={dn.id}>
              <td className="px-2 py-2">{dn.ref}</td>
              <td className="px-2 py-2">{dn.from.code}</td>
              <td className="px-2 py-2">{dn.toCampus.name}</td>
              <td className="px-2 py-2">{dn.receiver || "—"}</td>
              <td className="px-2 py-2 text-xs">
                {dn.lines.map((l) => `${l.sku.code} ${l.size}×${l.qty}`).join(", ")}
              </td>
              <td className="px-2 py-2">
                <div className="flex items-center gap-3">
                  <Link className="underline" href={`/delivery-note/${dn.id}`}>Print</Link>
                  {user.role === "STORE" ? (
                    <ConfirmModal
                      triggerLabel="Undo"
                      triggerTone="danger"
                      title={`Undo ${dn.ref}?`}
                      description={`Reverses the stock move (${dn.from.code} → ${dn.toCampus.name}) and, if this was linked to a campus request, reopens that request so it can be sent again correctly. Can't be reversed once confirmed.`}
                      confirmLabel="Yes, undo it"
                      action={voidDistribution}
                      hiddenFields={{ distributionId: dn.id }}
                    />
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </Table>
        <Pager page={page} totalPages={pageCount(dnsTotal)} />
      </Card>

      {user.role === "STORE" ? (
        <>
          <Card>
            <h2 className="mb-3 font-semibold">Open request queue</h2>
            <p className="mb-3 text-sm text-ink-muted">Send copies the lines from MAIN. No retyping.</p>
            <ul className="grid gap-3 text-sm">
              {requests.map((r) => {
                const shorts = shortByRequest.get(r.id) ?? [];
                return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-card-border pb-2 last:border-0">
                  <div>
                    <strong>{r.ref}</strong> · {r.campus.name}
                    <p className="text-ink-muted">
                      {r.lines.map((l) => `${l.sku.code} ${l.size}×${l.qty}`).join(", ")}
                    </p>
                    {shorts.length > 0 ? (
                      <div className="mt-2 grid gap-2 rounded-[10px] border border-danger bg-danger-15 p-2">
                        {shorts.map((m) => (
                          <div key={`${m.skuId}-${m.size}`} className="flex flex-wrap items-center gap-2">
                            <Badge tone="red">
                              MAIN short {m.shortfall} · {m.skuCode} {m.size} (have {m.onHand})
                            </Badge>
                            <ConfirmModal
                              triggerLabel="Send to Loveness"
                              triggerTone="primary"
                              tone="primary"
                              title={`Send ${m.skuCode} ${m.size} to Loveness?`}
                              description={`Queues a sewing job for the ${m.shortfall} unit${m.shortfall === 1 ? "" : "s"} still short — ${m.campusName}'s request (${m.requestRef}) is waiting on this.`}
                              confirmLabel="Send to Loveness"
                              action={createSewingJob}
                              hiddenFields={{
                                skuId: m.skuId,
                                size: m.size,
                                expected: String(m.shortfall),
                                location: "MAIN",
                                note: `${m.campusName} — ${m.requestRef} is waiting on this`,
                              }}
                            />
                            <ConfirmModal
                              triggerLabel="Raise PO"
                              triggerTone="ghost"
                              tone="primary"
                              wide
                              title={`Raise a PO for ${m.skuCode} ${m.size}?`}
                              description="Call the supplier for a real price before saving — this still needs Finance's approval before it can be sent."
                              confirmLabel="Save draft PO"
                              action={createPurchaseOrder}
                              hiddenFields={{ skuId: m.skuId, size: m.size, qty: String(m.shortfall) }}
                            >
                              <Field label="Supplier">
                                <select className={inputClass()} name="supplierId">
                                  {suppliers.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                </select>
                              </Field>
                              <Field label="Real unit cost TZS">
                                <input className={inputClass()} name="unitTzs" type="number" min={1} required />
                              </Field>
                            </ConfirmModal>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <ConfirmModal
                    triggerLabel="Send from MAIN"
                    triggerTone="primary"
                    tone="primary"
                    title={`Send ${r.ref} to ${r.campus.name}?`}
                    description={`Sends ${r.lines.map((l) => `${l.sku.code} ${l.size}×${l.qty}`).join(", ")} from MAIN to ${r.campus.name} for request ${r.ref} — real stock leaves MAIN as soon as you confirm.`}
                    confirmLabel="Send from MAIN"
                    action={fulfillRequest}
                    hiddenFields={{ requestId: r.id, fromCode: "MAIN" }}
                  />
                </li>
                );
              })}
              {requests.length === 0 ? <li>No open requests.</li> : null}
            </ul>
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">Issue delivery note</h2>
            <ConfirmModal
              triggerLabel="Post DN"
              triggerTone="primary"
              tone="primary"
              wide
              title="Post this delivery note?"
              description="This moves real stock from the source location straight into the destination campus's store the moment you confirm. Double-check the destination campus, SKU, size, and quantities below — if something's wrong, it can still be undone afterward with Undo."
              confirmLabel="Post DN"
              action={createDistribution}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="From">
                  <select className={inputClass()} name="fromId">
                    {sources.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="To campus">
                  <select className={inputClass()} name="toCampusId">
                    {campuses.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Link request (optional)">
                  <select className={inputClass()} name="requestId" defaultValue="">
                    <option value="">None</option>
                    {requests.map((r) => (
                      <option key={r.id} value={r.id}>{r.ref} · {r.campus.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Receiver name">
                  <input className={inputClass()} name="receiver" placeholder="Who signed" />
                </Field>
              </div>
              <LinesEditor
                skus={skus.map((s) => ({
                  id: s.id,
                  code: s.code,
                  name: s.name,
                  sellTzs: s.sellTzs,
                  buyTzs: s.buyTzs,
                  sizes: s.sizes.map((x) => x.size),
                }))}
              />
            </ConfirmModal>
          </Card>
        </>
      ) : null}
    </div>
  );
}
