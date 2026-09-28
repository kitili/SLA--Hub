import Link from "next/link";
import { createSewingJob } from "@/actions/sewing";
import { createPurchaseOrder } from "@/actions/purchase";
import { createCampusRequest } from "@/actions/requests";
import { AlertList } from "@/components/alert-list";
import { CampusFilter } from "@/components/campus-filter";
import { ConfirmModal } from "@/components/confirm-modal";
import { Badge, Card, Field, PageHeader, Table, inputClass } from "@/components/ui";
import { blockedOrderAlerts, clothAlerts, mainShortageAlerts, stockAlerts } from "@/lib/alerts";
import { requireUser } from "@/lib/auth";
import { isSchoolAdmin, schoolScope } from "@/lib/campus-scope";
import { listCampuses } from "@/lib/kpis";
import { canRequestForCampus } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export default async function AlertsPage() {
  const user = await requireUser(["STORE", "TAILOR", "FINANCE", "CEO", "ADMIN", "HEAD_TEACHER", "PRINCIPAL"]);
  const picked = await schoolScope(user);
  const loc =
    user.role === "TAILOR"
      ? { code: { in: ["MAIN", "SHOP_USA"] } }
      : user.campusId
        ? { campusId: user.campusId }
        : isSchoolAdmin(user)
          ? picked?.id
            ? { campusId: picked.id }
            : { kind: "CAMPUS" }
          : undefined;
  const canRequest = Boolean(user.campusId && user.campusCode && canRequestForCampus(user.role, user.campusCode));
  const [stock, cloth, blocked, mainShort, suppliers, sites] = await Promise.all([
    stockAlerts(loc),
    user.role === "STORE" || user.role === "TAILOR" || user.role === "FINANCE" ? clothAlerts() : Promise.resolve([]),
    blockedOrderAlerts(user.role === "STORE" ? undefined : (user.campusId ?? undefined)),
    user.role === "STORE" ? mainShortageAlerts() : Promise.resolve([]),
    user.role === "STORE" ? prisma.supplier.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    isSchoolAdmin(user) ? listCampuses() : Promise.resolve([]),
  ]);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Daily alerts"
        subtitle="Low sizes vs reorder, and cloth shortfall for open sewing jobs."
      />
      {isSchoolAdmin(user) ? <CampusFilter sites={sites} active={picked?.code} path="/alerts" persist /> : null}
      {blocked.length > 0 ? (
        <Card className="border-danger">
          <h2 className="mb-1 font-semibold">Paid orders waiting on stock</h2>
          <p className="mb-3 text-sm text-ink-muted">
            These families have paid in full, but the campus doesn&apos;t have what&apos;s needed to hand the kit over yet.
          </p>
          <Table headers={canRequest ? ["Order", "Student", "Item", "Size", "Need", "Have", ""] : ["Order", "Student", "Item", "Size", "Need", "Have"]}>
            {blocked.map((b) => (
              <tr key={`${b.orderId}-${b.skuId}-${b.size}`}>
                <td className="px-2 py-2">
                  <Link className="underline" href={`/orders/${b.orderId}`}>{b.orderRef}</Link>
                </td>
                <td className="px-2 py-2">{b.studentName}<div className="text-xs text-ink-muted">{b.campusName}</div></td>
                <td className="px-2 py-2">{b.skuCode} · {b.skuName}</td>
                <td className="px-2 py-2">{b.size}</td>
                <td className="px-2 py-2">{b.needed}</td>
                <td className="px-2 py-2"><Badge tone="red">{b.onHand}</Badge></td>
                {canRequest ? (
                  <td className="px-2 py-2 text-right">
                    <ConfirmModal
                      triggerLabel="Request"
                      triggerTone="primary"
                      tone="primary"
                      title={`Request ${b.skuCode} ${b.size} from Imani?`}
                      description={`Sends a campus request for the ${b.shortfall} unit${b.shortfall === 1 ? "" : "s"} still short — ${b.studentName}'s order (${b.orderRef}) is fully paid and waiting on this.`}
                      confirmLabel="Send to Imani"
                      action={createCampusRequest}
                      hiddenFields={{
                        skuId: b.skuId,
                        size: b.size,
                        qty: String(b.shortfall),
                        note: `${b.studentName} — ${b.orderRef} is fully paid and waiting on this`,
                      }}
                    >
                      <Field label="Needed by">
                        <input className={inputClass()} name="neededBy" type="date" />
                      </Field>
                    </ConfirmModal>
                  </td>
                ) : null}
              </tr>
            ))}
          </Table>
        </Card>
      ) : null}
      {mainShort.length > 0 ? (
        <Card className="border-danger">
          <h2 className="mb-1 font-semibold">MAIN can&apos;t fill these requests yet</h2>
          <p className="mb-3 text-sm text-ink-muted">
            A campus has an open request for these, but MAIN&apos;s own stock is short — sending won&apos;t work until this is resolved.
          </p>
          <Table headers={["Request", "Campus", "Item", "Size", "Need", "Have", ""]}>
            {mainShort.map((m) => (
              <tr key={`${m.requestId}-${m.skuId}-${m.size}`}>
                <td className="px-2 py-2">
                  <Link className="underline" href="/requests">{m.requestRef}</Link>
                </td>
                <td className="px-2 py-2">{m.campusName}</td>
                <td className="px-2 py-2">{m.skuCode} · {m.skuName}</td>
                <td className="px-2 py-2">{m.size}</td>
                <td className="px-2 py-2">{m.needed}</td>
                <td className="px-2 py-2"><Badge tone="red">{m.onHand}</Badge></td>
                <td className="px-2 py-2 text-right">
                  <div className="flex justify-end gap-2">
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
                      description={`Call the supplier for a real price before saving — this still needs Finance's approval before it can be sent.`}
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
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : null}
      <AlertList stock={stock} cloth={cloth} />
      <Card>
        <h2 className="mb-3 font-semibold">Low sizes</h2>
        <Table headers={["Location", "SKU", "Size", "On hand", "Reorder"]}>
          {stock.map((a) => (
            <tr key={`${a.location}-${a.sku}-${a.size}`}>
              <td className="px-2 py-2">{a.location}</td>
              <td className="px-2 py-2">{a.sku} {a.name}</td>
              <td className="px-2 py-2">{a.size}</td>
              <td className="px-2 py-2">{a.qty}</td>
              <td className="px-2 py-2">{a.reorder}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
