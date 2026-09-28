import Link from "next/link";
import { deleteExpense, setBudget, updateExpense } from "@/actions/finance";
import { approveMaterialRequest, rejectMaterialRequest } from "@/actions/material-requests";
import { approvePurchaseOrder, rejectPurchaseOrder } from "@/actions/purchase";
import { ConfirmModal } from "@/components/confirm-modal";
import { Badge, Card, Field, Money, Pager, PageHeader, Table, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { loadPlanBudget } from "@/lib/overall-plan";
import { pageCount, PAGE_SIZE, pageSkip, parsePage } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { couponGap, profitTzs, sewingPnl } from "@/lib/sheet-math";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser(["FINANCE", "STORE", "CEO"]);
  const canEditExpenses = user.role === "FINANCE" || user.role === "STORE";
  const page = parsePage((await searchParams).page);
  const year = new Date().getFullYear();
  // `allExpenses` (amountTzs only) drives the "recorded expenses" total below
  // and must cover every expense, not just the page shown in the table.
  const [
    budget,
    allExpenses,
    expenses,
    expensesTotal,
    payments,
    issues,
    campuses,
    pos,
    orderLines,
    jobs,
    budgeted,
    pendingPos,
    pendingMatReqs,
    approvedMatReqs,
    fulfilledMatReqs,
    budgetHistory,
  ] = await Promise.all([
      prisma.budget.findFirst({ where: { year } }),
      prisma.expense.findMany({ select: { amountTzs: true } }),
      prisma.expense.findMany({ orderBy: { spentOn: "desc" }, skip: pageSkip(page), take: PAGE_SIZE }),
      prisma.expense.count(),
      prisma.payment.findMany({ include: { order: { include: { campus: true } } } }),
      prisma.parentIssue.findMany({ include: { sku: true, order: { include: { campus: true } } } }),
      prisma.campus.findMany(),
      prisma.purchaseOrder.findMany({ include: { lines: true } }),
      prisma.parentOrderLine.findMany(),
      prisma.sewingJob.findMany({ include: { sku: true, expenses: true } }),
      loadPlanBudget(2027),
      user.role === "FINANCE" || user.role === "STORE"
        ? prisma.purchaseOrder.findMany({
            where: { approveStatus: "PENDING", status: "DRAFT" },
            include: { lines: { include: { sku: true } }, supplier: true, raisedBy: true },
          })
        : Promise.resolve([]),
      user.role === "FINANCE" || user.role === "STORE"
        ? prisma.materialRequest.findMany({
            where: { status: "PENDING_FINANCE" },
            include: { lines: { include: { payee: true } }, sewingJob: { include: { sku: true } }, requestedBy: true, pricedBy: true },
          })
        : Promise.resolve([]),
      prisma.materialRequest.findMany({ where: { status: "APPROVED" }, include: { lines: true } }),
      prisma.materialRequest.findMany({ where: { status: "FULFILLED" }, include: { lines: true } }),
      user.role === "FINANCE" || user.role === "STORE" ? prisma.budget.findMany({ orderBy: { year: "desc" } }) : Promise.resolve([]),
    ]);
  const planTotals = budgeted.totals;

  const spend = allExpenses.reduce((s, e) => s + e.amountTzs, 0);
  // Confirmed only — money a campus admin recorded but Finance hasn't
  // verified yet shouldn't inflate the reported revenue figure.
  const sales = payments.filter((p) => p.confirmStatus === "CONFIRMED").reduce((s, p) => s + p.amountTzs, 0);
  const pendingSales = payments.filter((p) => p.confirmStatus === "PENDING").reduce((s, p) => s + p.amountTzs, 0);
  const issuedRevenue = issues.reduce((s, i) => s + i.qty * i.sku.sellTzs, 0);
  const issuedCost = issues.reduce((s, i) => s + i.qty * i.sku.buyTzs, 0);
  const issuedMargin = issues.reduce((s, i) => s + profitTzs(i.qty, i.sku.buyTzs, i.sku.sellTzs), 0);
  const couponQty = orderLines.reduce((s, l) => s + l.qty, 0);
  const distributedQty = issues.reduce((s, i) => s + i.qty, 0);
  const sew = jobs
    .filter((j) => j.status === "DONE")
    .map((j) => {
      const material = j.expenses.filter((e) => e.kind === "MATERIAL").reduce((s, e) => s + e.amountTzs, 0);
      const labour = j.expenses.filter((e) => e.kind === "LABOUR").reduce((s, e) => s + e.amountTzs, 0);
      return { job: j, ...sewingPnl(j.actual, j.sku.buyTzs, material, labour) };
    });
  const sewSaved = sew.reduce((s, r) => s + r.savedTzs, 0);
  const committedPos = pos
    .filter((p) => ["SENT", "PARTIAL", "DRAFT"].includes(p.status))
    .reduce((s, p) => s + p.lines.reduce((a, l) => a + (l.qty - l.received) * l.unitTzs, 0), 0);
  // Approved-but-not-yet-bought materials/labour are money Finance has
  // already committed to, same as an open PO — has to count against the
  // budget now, not only once Imani actually posts the purchase.
  const committedMatReqs = approvedMatReqs.reduce(
    (s, r) => s + r.lines.reduce((a, l) => a + l.qty * l.unitCostTzs, 0),
    0,
  );
  const committed = committedPos + committedMatReqs;
  const receivedPo = pos.reduce(
    (s, p) => s + p.lines.reduce((a, l) => a + l.received * l.unitTzs, 0),
    0,
  );
  // Once a material/labour request is actually bought, its cost stops being
  // "committed" (that bucket is only for money not yet spent) — but it still
  // has to come off the budget somewhere, or real spend silently reappears
  // as "remaining."
  const realizedMatReqSpend = fulfilledMatReqs.reduce(
    (s, r) => s + r.lines.reduce((a, l) => a + l.qty * l.unitCostTzs, 0),
    0,
  );
  const remainingBudget = (budget?.allocatedTzs ?? 0) - receivedPo - committed - realizedMatReqSpend;

  const campusRows = campuses.map((c) => {
    const slice = issues.filter((i) => i.order.campusId === c.id);
    const rev = slice.reduce((s, i) => s + i.qty * i.sku.sellTzs, 0);
    const cost = slice.reduce((s, i) => s + i.qty * i.sku.buyTzs, 0);
    return { name: c.name, rev, cost, margin: profitTzs(1, cost, rev) };
  });

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Money"
        title="Finance desk"
        subtitle="Buy vs sell vs sewing cost. Budget vs committed POs vs received goods."
        actions={
          <div className="flex gap-3 text-sm font-semibold">
            <Link className="text-electric-blue no-underline" href="/reports">KPIs</Link>
            <Link className="text-electric-blue no-underline" href="/orders">Orders</Link>
            <Link className="text-electric-blue no-underline" href="/sizes">Plan</Link>
            <Link className="text-electric-blue no-underline" href="/analytics">Year-end</Link>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-4">
        <Card><p className="text-sm text-[var(--muted)]">Budget {year}</p><p className="text-2xl"><Money amount={budget?.allocatedTzs ?? 0} /></p></Card>
        <Card><p className="text-sm text-[var(--muted)]">Remaining after POs &amp; requests</p><p className="text-2xl"><Money amount={remainingBudget} /></p></Card>
        <Card>
          <p className="text-sm text-[var(--muted)]">Parent payments</p>
          <p className="text-2xl"><Money amount={sales} /></p>
          {pendingSales > 0 ? (
            <Link className="text-xs font-semibold text-electric-blue no-underline" href="/orders">
              +<Money amount={pendingSales} /> awaiting your confirmation →
            </Link>
          ) : null}
        </Card>
        <Card><p className="text-sm text-[var(--muted)]">Issued margin (sell − buy)</p><p className="text-2xl"><Money amount={issuedMargin} /></p></Card>
      </div>
      {user.role === "FINANCE" || user.role === "STORE" ? (
        <Card>
          <h2 className="mb-3 font-semibold">Set budget</h2>
          <ConfirmModal
            triggerLabel={`Edit ${year} budget`}
            triggerTone="primary"
            tone="primary"
            title={`Set the ${year} uniform budget?`}
            description="This is the number every remaining-budget figure across Finance, Money desk, and Plan is measured against."
            confirmLabel="Save budget"
            action={setBudget}
          >
            <Field label="Year">
              <input className={inputClass()} name="year" type="number" defaultValue={year} required />
            </Field>
            <Field label="Amount TZS">
              <input className={inputClass()} name="allocatedTzs" type="number" min={1} defaultValue={budget?.allocatedTzs ?? ""} required />
            </Field>
            <Field label="Name (optional)">
              <input className={inputClass()} name="name" defaultValue={budget?.name ?? ""} />
            </Field>
          </ConfirmModal>
          {budgetHistory.length > 0 ? (
            <Table headers={["Year", "Name", "Amount"]}>
              {budgetHistory.map((b) => (
                <tr key={b.id} className={b.year === year ? "font-semibold" : undefined}>
                  <td className="px-2 py-2">{b.year}</td>
                  <td className="px-2 py-2">{b.name}</td>
                  <td className="px-2 py-2"><Money amount={b.allocatedTzs} /></td>
                </tr>
              ))}
            </Table>
          ) : null}
        </Card>
      ) : null}
      {(user.role === "FINANCE" || user.role === "STORE") && pendingPos.length > 0 ? (
        <Card className="border-danger">
          <h2 className="mb-3 font-semibold">Purchase orders awaiting your approval</h2>
          <ul className="grid gap-3 text-sm">
            {pendingPos.map((po) => {
              const value = po.lines.reduce((s, l) => s + l.qty * l.unitTzs, 0);
              return (
                <li key={po.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-card-border pb-2 last:border-0">
                  <div>
                    <strong>{po.ref}</strong> · {po.supplier.name} · raised by {po.raisedBy.name}
                    <p className="text-ink-muted">
                      {po.lines.map((l) => `${l.sku.code} ${l.size}×${l.qty} @ ${l.unitTzs.toLocaleString()}`).join(", ")}
                    </p>
                    <p className="font-semibold"><Money amount={value} /></p>
                  </div>
                  <div className="flex gap-2">
                    <ConfirmModal
                      triggerLabel="Approve"
                      triggerTone="primary"
                      tone="primary"
                      title={`Approve ${po.ref}?`}
                      description={
                        `Releases ${po.raisedBy.name} to send this order to ${po.supplier.name}. ` +
                        (remainingBudget < 0
                          ? `Remaining budget is already ${remainingBudget.toLocaleString()} TZS (over budget) with this PO included.`
                          : `Remaining budget with this PO included: ${remainingBudget.toLocaleString()} TZS.`)
                      }
                      confirmLabel="Yes, approve"
                      action={approvePurchaseOrder}
                      hiddenFields={{ poId: po.id }}
                    />
                    <ConfirmModal
                      triggerLabel="Reject"
                      triggerTone="danger"
                      title={`Reject ${po.ref}?`}
                      description="This PO can't be sent to a supplier until it's edited and re-submitted."
                      confirmLabel="Yes, reject"
                      action={rejectPurchaseOrder}
                      hiddenFields={{ poId: po.id }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
      {(user.role === "FINANCE" || user.role === "STORE") && pendingMatReqs.length > 0 ? (
        <Card className="border-danger">
          <h2 className="mb-3 font-semibold">Materials &amp; labour awaiting your approval</h2>
          <ul className="grid gap-3 text-sm">
            {pendingMatReqs.map((r) => {
              const total = r.lines.reduce((s, l) => s + l.qty * l.unitCostTzs, 0);
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-card-border pb-2 last:border-0">
                  <div>
                    <strong>{r.ref}</strong> · {r.sewingJob.sku.code} {r.sewingJob.size} · requested by {r.requestedBy.name}
                    {r.pricedBy ? <> · priced by {r.pricedBy.name}</> : null}
                    <ul className="mt-1 text-ink-muted">
                      {r.lines.map((l) => (
                        <li key={l.id}>
                          {l.kind === "LABOUR" ? "Labour" : l.materialKind} — {l.description} · {l.qty} {l.unit} @{" "}
                          {l.unitCostTzs.toLocaleString()} = {(l.qty * l.unitCostTzs).toLocaleString()} TZS
                          {l.payee ? ` · paid to ${l.payee.name}` : ""}
                        </li>
                      ))}
                    </ul>
                    <p className="font-semibold">Total <Money amount={total} /></p>
                  </div>
                  <div className="flex gap-2">
                    <ConfirmModal
                      triggerLabel="Approve"
                      triggerTone="primary"
                      tone="primary"
                      title={`Approve ${r.ref}?`}
                      description={
                        `Releases money for ${r.requestedBy.name}'s job to be bought — ${total.toLocaleString()} TZS total. ` +
                        (remainingBudget - total < 0
                          ? `This will bring remaining budget to ${(remainingBudget - total).toLocaleString()} TZS (over budget).`
                          : `Remaining budget after this: ${(remainingBudget - total).toLocaleString()} TZS.`)
                      }
                      confirmLabel="Yes, approve"
                      action={approveMaterialRequest}
                      hiddenFields={{ requestId: r.id }}
                    />
                    <ConfirmModal
                      triggerLabel="Reject"
                      triggerTone="danger"
                      title={`Reject ${r.ref}?`}
                      description="Nothing gets bought against this request. Loveness or Imani will need to submit a fresh one."
                      confirmLabel="Yes, reject"
                      action={rejectMaterialRequest}
                      hiddenFields={{ requestId: r.id }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
      <Card>
        <h2 className="mb-3 font-semibold">Network vs campus</h2>
        <Table headers={["Campus", "Issued revenue", "Buy cost", "Margin"]}>
          <tr>
            <td className="px-2 py-2 font-semibold">Network</td>
            <td className="px-2 py-2"><Money amount={issuedRevenue} /></td>
            <td className="px-2 py-2"><Money amount={issuedCost} /></td>
            <td className="px-2 py-2"><Money amount={issuedMargin} /></td>
          </tr>
          {campusRows.map((row) => (
            <tr key={row.name}>
              <td className="px-2 py-2">{row.name}</td>
              <td className="px-2 py-2"><Money amount={row.rev} /></td>
              <td className="px-2 py-2"><Money amount={row.cost} /></td>
              <td className="px-2 py-2"><Money amount={row.margin} /></td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">OVERALL planned buy (enrolment × pack − campus − MAIN)</h2>
        <p className="text-sm text-[var(--muted)]">
          Order {planTotals.orderQty} pieces · MAIN covers {planTotals.mainCover} ·
          buy <Money amount={planTotals.orderCostTzs} /> ·
          if sold <Money amount={planTotals.orderSellTzs} /> · profit <Money amount={planTotals.profitTzs} />
        </p>
        <p className="mt-2 text-sm">
          Remaining budget <Money amount={budgeted.remainingBudgetTzs} />
          {budgeted.fits ? " · within budget" : <> · over by <Money amount={budgeted.overByTzs} /></>}
        </p>
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Coupon vs distribution</h2>
        <p className="text-sm text-[var(--muted)]">
          Coupon pieces {couponQty} · handed over {distributedQty} · still to issue {couponGap(couponQty, distributedQty)}
        </p>
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Sewing P&amp;L (jora + labour vs city buy)</h2>
        {sew.length ? (
          <Table headers={["Job", "Pieces", "City-buy replacement", "Sewn cost", "Saved"]}>
            {sew.map((row) => (
              <tr key={row.job.id}>
                <td className="px-2 py-2">{row.job.sku.code} {row.job.size}</td>
                <td className="px-2 py-2">{row.job.actual}</td>
                <td className="px-2 py-2"><Money amount={row.replacementTzs} /></td>
                <td className="px-2 py-2"><Money amount={row.sewnCostTzs} /></td>
                <td className="px-2 py-2"><Money amount={row.savedTzs} /></td>
              </tr>
            ))}
          </Table>
        ) : (
          <p className="text-sm text-ink-muted">No completed sewing jobs yet.</p>
        )}
        <p className="mt-2 text-sm text-[var(--muted)]">Saved vs buying the same pieces in the city: <Money amount={sewSaved} /></p>
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Budget vs POs</h2>
        <p className="text-sm text-[var(--muted)]">
          Committed (not yet received) <Money amount={committed} /> · Received <Money amount={receivedPo} /> · Recorded expenses <Money amount={spend} />
        </p>
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Expenses</h2>
        <Table headers={canEditExpenses ? ["When", "Kind", "Amount", "Note", ""] : ["When", "Kind", "Amount", "Note"]}>
          {expenses.map((e) => (
            <tr key={e.id}>
              <td className="px-2 py-2 text-xs">{e.spentOn.toISOString().slice(0, 10)}</td>
              <td className="px-2 py-2"><Badge>{e.kind}</Badge></td>
              <td className="px-2 py-2"><Money amount={e.amountTzs} /></td>
              <td className="px-2 py-2">{e.note}</td>
              {canEditExpenses ? (
                <td className="px-2 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <ConfirmModal
                      triggerLabel="Edit"
                      triggerTone="ghost"
                      tone="primary"
                      title="Edit expense"
                      description="This corrects the Finance-side record only - it doesn't reopen or re-total whatever purchase order or sewing job originally created it."
                      confirmLabel="Save changes"
                      action={updateExpense}
                      hiddenFields={{ expenseId: e.id }}
                    >
                      <Field label="Kind">
                        <select className={inputClass()} name="kind" defaultValue={e.kind}>
                          <option value="SUPPLIER">Supplier</option>
                          <option value="LABOUR">Labour</option>
                          <option value="MATERIAL">Material</option>
                        </select>
                      </Field>
                      <Field label="Amount TZS">
                        <input className={inputClass()} name="amountTzs" type="number" defaultValue={e.amountTzs} required />
                      </Field>
                      <Field label="Note">
                        <input className={inputClass()} name="note" defaultValue={e.note} />
                      </Field>
                    </ConfirmModal>
                    <ConfirmModal
                      triggerLabel="Delete"
                      triggerTone="danger"
                      title="Delete this expense?"
                      description="Removes it from the Finance record only - it doesn't reopen or re-total whatever purchase order or sewing job originally created it. This can't be undone."
                      confirmLabel="Yes, delete it"
                      action={deleteExpense}
                      hiddenFields={{ expenseId: e.id }}
                    />
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </Table>
        <Pager page={page} totalPages={pageCount(expensesTotal)} />
      </Card>
    </div>
  );
}
