import Link from "next/link";
import { markKitReady } from "@/actions/ops";
import { cancelOrder, confirmPayment, issueOrder, recordPayment, rejectPayment, updateOrderLines, voidPayment } from "@/actions/orders";
import { collectMessage } from "@/lib/ready";
import { smsHref, waHref } from "@/lib/phone";
import { ConfirmModal } from "@/components/confirm-modal";
import { LinesEditor } from "@/components/lines-editor";
import { Badge, Btn, Card, Field, Money, PageHeader, Table, inputClass, statusTone } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { canIssueKit, orderPaid, orderRecordedPaid, orderTotal } from "@/lib/order-status";
import { ACTIVE_SKU } from "@/lib/constants";
import { assertOrder, canIssue, canTakePayment } from "@/lib/visibility";

export default async function OrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser(["STORE", "FINANCE", "CEO", "ADMIN", "HEAD_TEACHER", "PRINCIPAL"]);
  const { id } = await params;
  const order = await prisma.parentOrder.findUnique({
    where: { id },
    include: {
      campus: true,
      lines: { include: { sku: true } },
      pays: { include: { voidedBy: true } },
      issues: true,
      placedBy: true,
      student: { include: { family: true } },
    },
  });
  if (!order) notFound();
  await assertOrder(user, order);
  const total = orderTotal(order.lines);
  const paid = orderPaid(order.pays);
  const pendingPaid = orderRecordedPaid(order.pays) - paid;
  const locations = await prisma.location.findMany({
    where:
      user.role === "STORE"
        ? { OR: [{ campusId: order.campusId, kind: "CAMPUS" }, { code: { in: ["MAIN", "SHOP_USA"] } }] }
        : { campusId: user.campusId ?? "none", kind: "CAMPUS" },
  });
  const canEditOwnOrder = ["STORE", "ADMIN", "HEAD_TEACHER"].includes(user.role);
  const skus = canEditOwnOrder
    ? await prisma.sku.findMany({
        where: { OR: [ACTIVE_SKU, { id: { in: order.lines.map((l) => l.skuId) } }] },
        include: { sizes: true },
        orderBy: { code: "asc" },
      })
    : [];

  // A family never gets part of a kit — every remaining line has to be in
  // stock at the campus's own store before "Issue to parent" is even shown,
  // not just checked after the admin already tried.
  const remainingLines = order.lines.filter((l) => l.qty - l.issued > 0);
  const campusStoreLoc = locations.find((l) => l.campusId === order.campusId && l.kind === "CAMPUS");
  const stockChecks = campusStoreLoc
    ? await Promise.all(
        remainingLines.map(async (line) => {
          const remaining = line.qty - line.issued;
          const balance = await prisma.stockBalance.findUnique({
            where: { locationId_skuId_size: { locationId: campusStoreLoc.id, skuId: line.skuId, size: line.size } },
          });
          const onHand = balance?.qty ?? 0;
          return { line, onHand, remaining, ready: onHand >= remaining };
        }),
      )
    : [];
  const notReady = stockChecks.filter((c) => !c.ready);
  const readyToIssue = remainingLines.length > 0 && Boolean(campusStoreLoc) && notReady.length === 0;

  return (
    <div className="grid gap-6">
      <Link className="text-sm font-semibold text-electric-blue no-underline" href="/orders">
        ← Back to Orders
      </Link>
      <PageHeader
        eyebrow={order.campus.name}
        title={order.ref}
        subtitle={`${order.studentName} · ${order.className} · ${order.gender} · ${order.regNo || "no reg"}`}
        actions={
          <>
            <Link className="rounded-[10px] border border-card-border bg-white px-3 py-2 text-sm font-semibold text-electric-blue no-underline hover:bg-light-blue-30" href={`/coupon/${order.id}`}>
              Print coupon
            </Link>
            {canEditOwnOrder && order.status !== "FULFILLED" && order.status !== "CANCELLED" ? (
              <ConfirmModal
                triggerLabel="Edit lines"
                triggerTone="ghost"
                tone="primary"
                wide
                title={`Edit ${order.ref}`}
                description="Change the items, sizes, or quantities on this coupon. Anything already issued stays as-is."
                confirmLabel="Save changes"
                action={updateOrderLines}
                hiddenFields={{ orderId: order.id }}
              >
                <LinesEditor
                  showCost={false}
                  skus={skus.map((s) => ({
                    id: s.id,
                    code: s.code,
                    name: s.name,
                    sellTzs: s.sellTzs,
                    buyTzs: s.buyTzs,
                    sizes: s.sizes.map((x) => x.size),
                  }))}
                  initialRows={order.lines.map((l) => ({ skuId: l.skuId, size: l.size, qty: l.qty }))}
                />
              </ConfirmModal>
            ) : null}
            {canEditOwnOrder && order.status !== "FULFILLED" && order.status !== "CANCELLED" ? (
              <ConfirmModal
                triggerLabel="Cancel coupon"
                title={`Cancel ${order.ref}?`}
                description={`This cancels the coupon for ${order.studentName}. Any recorded payments will need Finance to sort out separately. This can't be undone.`}
                confirmLabel="Yes, cancel it"
                action={cancelOrder}
                hiddenFields={{ orderId: order.id }}
              />
            ) : null}
          </>
        }
      />
      <div className="flex gap-2">
        <Badge tone={statusTone(order.status)}>{order.status}</Badge>
        <Badge tone="grey">Ordered {order.orderedAt.toISOString().slice(0, 10)}</Badge>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold">Lines</h2>
        <Table headers={["Item", "Size", "Qty", "Issued", "Unit", "Line"]}>
          {order.lines.map((line) => (
            <tr key={line.id}>
              <td className="px-2 py-2">{line.sku.code} · {line.sku.name}</td>
              <td className="px-2 py-2">{line.size}</td>
              <td className="px-2 py-2">{line.qty}</td>
              <td className="px-2 py-2">{line.issued}</td>
              <td className="px-2 py-2"><Money amount={line.unitTzs} /></td>
              <td className="px-2 py-2"><Money amount={line.qty * line.unitTzs} /></td>
            </tr>
          ))}
        </Table>
        <p className="mt-3 text-sm">
          Total <Money amount={total} /> · Paid <Money amount={paid} /> · Remaining{" "}
          <Money amount={total - paid} />
          {pendingPaid > 0 ? (
            <span className="text-ink-muted"> · plus <Money amount={pendingPaid} /> pending Finance confirmation</span>
          ) : null}
        </p>
      </Card>

      {canTakePayment(user.role) && paid < total && order.status !== "CANCELLED" ? (
        <Card>
          <h2 className="mb-3 font-semibold">Record payment</h2>
          <ConfirmModal
            triggerLabel="Record payment"
            triggerTone="primary"
            tone="primary"
            wide
            title="Record this payment?"
            description={
              user.role === "STORE" || user.role === "FINANCE"
                ? "This logs real money against the coupon and counts as confirmed immediately, since you cover Finance. If the amount or channel turns out wrong, it can be corrected later via reject or undo — but double-check both before submitting."
                : "This logs the payment as pending — it won't count toward the coupon's paid total or unlock issuing the kit until Imani confirms the money actually reached her. Double-check the amount and channel before submitting."
            }
            confirmLabel="Yes, record it"
            action={recordPayment}
            hiddenFields={{ orderId: order.id }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Amount TZS">
                <input className={inputClass()} name="amountTzs" type="number" min={1} required defaultValue={Math.max(total - paid, 0) || total} />
              </Field>
              <Field label="Channel">
                <select className={inputClass()} name="channel">
                  <option value="CASH">Cash</option>
                  <option value="LIPA">Lipa</option>
                  <option value="UNIFORM_ACCOUNT">Uniform account</option>
                </select>
              </Field>
            </div>
          </ConfirmModal>
        </Card>
      ) : paid >= total ? (
        <Card>
          <p className="text-sm text-success">Paid in full.</p>
          {order.status !== "FULFILLED" && ["STORE", "ADMIN", "HEAD_TEACHER"].includes(user.role) ? (
            <ReadyNotice
              orderId={order.id}
              orderRef={order.ref}
              studentName={order.studentName}
              campusName={order.campus.name}
              phone={order.student?.family?.phone || order.placedBy?.phone || ""}
              already={Boolean(order.readyAt)}
            />
          ) : null}
        </Card>
      ) : null}

      {order.pays.length > 0 ? (
        <Card>
          <h2 className="mb-3 font-semibold">Payment history</h2>
          {order.pays.some((p) => p.confirmStatus === "PENDING") ? (
            <p className="mb-3 rounded-[10px] border border-gold bg-gold-15 px-3 py-2 text-sm">
              Some money recorded here hasn&apos;t been confirmed yet — the order won&apos;t show as fully paid, and
              the kit can&apos;t be issued, until it is.
            </p>
          ) : null}
          <ul className="grid gap-1 text-sm">
            {order.pays.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className={p.amountTzs < 0 ? "text-danger" : p.confirmStatus === "REJECTED" ? "text-ink-muted line-through" : ""}>
                  {p.receivedOn.toISOString().slice(0, 10)} · {p.channel} · {p.ref} · <Money amount={p.amountTzs} />
                  {p.voidOfId ? " · reversal" : ""}
                </span>
                <span className="flex items-center gap-2">
                  {p.confirmStatus === "PENDING" ? <Badge tone="gold">Pending confirmation</Badge> : null}
                  {p.confirmStatus === "REJECTED" ? <Badge tone="red">Rejected</Badge> : null}
                  {(user.role === "STORE" || user.role === "FINANCE") && p.confirmStatus === "PENDING" ? (
                    <>
                      <ConfirmModal
                        triggerLabel="Confirm"
                        triggerTone="ghost"
                        tone="primary"
                        title="Confirm this payment?"
                        description={`Marks this ${p.channel} ${p.amountTzs.toLocaleString()} TZS as verified received — from here it counts toward the order's official paid total and unlocks issuing the kit.`}
                        confirmLabel="Yes, I've received this"
                        action={confirmPayment}
                        hiddenFields={{ paymentId: p.id }}
                      />
                      <ConfirmModal
                        triggerLabel="Reject"
                        triggerTone="ghost"
                        tone="danger"
                        title="Reject this payment?"
                        description="Use this if the money never actually reached you, or the amount recorded is wrong. It won't affect the order's balance either way — a pending entry hasn't counted yet. Whoever recorded it should re-enter the correct amount."
                        confirmLabel="Yes, reject it"
                        action={rejectPayment}
                        hiddenFields={{ paymentId: p.id }}
                      />
                    </>
                  ) : null}
                  {canTakePayment(user.role) && p.amountTzs > 0 && p.confirmStatus === "CONFIRMED" && !p.voidOfId && !p.voidedBy ? (
                    <ConfirmModal
                      triggerLabel="Undo"
                      triggerTone="ghost"
                      tone="danger"
                      title={`Undo this payment?`}
                      description={`Posts an equal-and-opposite entry (-${p.amountTzs.toLocaleString()} TZS) rather than deleting it — the original stays in history, marked as reversed. Use this to correct a mistaken amount or channel.`}
                      confirmLabel="Yes, undo it"
                      action={voidPayment}
                      hiddenFields={{ paymentId: p.id }}
                    />
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {canIssue(user.role) && paid > 0 && !canIssueKit(paid, total, order.status) && order.status !== "FULFILLED" ? (
        <Card>
          <p className="text-sm text-ink-muted">Clear the balance before handing over kit.</p>
        </Card>
      ) : null}

      {canIssue(user.role) && canIssueKit(paid, total, order.status) && remainingLines.length > 0 ? (
        readyToIssue ? (
          <Card>
            <h2 className="mb-3 font-semibold">Issue to parent</h2>
            <p className="mb-3 text-sm text-success">
              Everything on this order is in stock at {campusStoreLoc?.name} — ready to hand over.
            </p>
            <ConfirmModal
              triggerLabel="Issue to parent"
              triggerTone="primary"
              tone="primary"
              title="Issue the full kit to the parent?"
              description="Hands over everything left on this order in one go — the family never receives a partial kit. This can't be undone from here."
              confirmLabel="Yes, issue it all"
              action={issueOrder}
              hiddenFields={{ orderId: order.id, locationId: campusStoreLoc?.id ?? "" }}
            />
          </Card>
        ) : (
          <Card className="border-danger">
            <h2 className="mb-1 font-semibold">Not ready to issue yet</h2>
            <p className="mb-2 text-sm text-ink-muted">
              The family can&apos;t collect a partial kit — every item below still needs to arrive at{" "}
              {campusStoreLoc?.name ?? "the campus store"} first.
            </p>
            <ul className="grid gap-1 text-sm">
              {notReady.map((c) => (
                <li key={`${c.line.skuId}-${c.line.size}`}>
                  <Badge tone="red">{c.line.sku.code} {c.line.size} — have {c.onHand}, need {c.remaining}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        )
      ) : null}
    </div>
  );
}

function ReadyNotice({
  orderId,
  orderRef,
  studentName,
  campusName,
  phone,
  already,
}: {
  orderId: string;
  orderRef: string;
  studentName: string;
  campusName: string;
  phone: string;
  already: boolean;
}) {
  const sw = collectMessage({ studentName, campusName, ref: orderRef, sw: true });
  const wa = waHref(phone, sw);
  const sms = smsHref(phone, sw);
  return (
    <div className="mt-3 grid gap-2">
      <p className="text-sm">{already ? "Marked ready. Tell the parent to come collect." : "Kit can be collected. Notify the parent."}</p>
      <form action={markKitReady}>
        <input type="hidden" name="orderId" value={orderId} />
        <Btn>{already ? "Send again" : "Kit ready"}</Btn>
      </form>
      {wa ? (
        <a className="text-sm font-semibold text-electric-blue" href={wa} target="_blank" rel="noreferrer">
          WhatsApp
        </a>
      ) : (
        <p className="text-xs text-ink-muted">No family phone — parent can save it in the app.</p>
      )}
      {sms ? (
        <a className="text-sm font-semibold text-electric-blue" href={sms}>
          SMS
        </a>
      ) : null}
    </div>
  );
}
