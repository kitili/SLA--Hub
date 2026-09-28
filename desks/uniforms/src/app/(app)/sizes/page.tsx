import { runForecast } from "@/actions/analytics";
import { saveEnrolment, savePrices } from "@/actions/plan";
import { draftPoFromPlan } from "@/actions/purchase";
import { ConfirmModal } from "@/components/confirm-modal";
import { Btn, Card, Field, Money, PageHeader, Table, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { loadPlanBudget } from "@/lib/overall-plan";
import { prisma } from "@/lib/prisma";
import { PRIMARY_CLASSES } from "@/lib/sheet-math";

export default async function SizesPage() {
  const user = await requireUser(["STORE", "FINANCE", "CEO"]);
  const canEdit = user.role !== "CEO";
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const enrolmentYear = 2027;
  const [issues, balances, enrolment, fits, budgeted, suppliers, skus, campuses, poPlan2027] = await Promise.all([
    prisma.parentIssue.findMany({ include: { sku: true } }),
    prisma.stockBalance.findMany({ include: { sku: true, location: true } }),
    prisma.campusEnrolment.findMany({ include: { campus: true }, where: { year: enrolmentYear }, orderBy: [{ campus: { name: "asc" } }, { className: "asc" }] }),
    prisma.sizeFit.findMany({ include: { sku: true }, orderBy: [{ className: "asc" }, { gender: "asc" }, { sku: { code: "asc" } }] }),
    loadPlanBudget(2027),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.sku.findMany({ orderBy: { code: "asc" } }),
    // Fetched directly, not derived from `enrolment` — a brand-new year (or a
    // campus with zero rows so far) would otherwise show an empty table with
    // no way to add anything, since there'd be no campus to even render a row for.
    prisma.campus.findMany({ orderBy: { name: "asc" } }),
    // draftPoFromPlan silently deletes-and-replaces this PO's lines (and
    // possibly its supplier) whenever it already exists as DRAFT/CANCELLED —
    // fetched up front so the confirm modal below can warn about that instead
    // of springing it on whoever clicks the button.
    prisma.purchaseOrder.findUnique({ where: { ref: "PO-PLAN-2027" }, include: { lines: true } }),
  ]);
  const { plan, totals } = budgeted;
  const vs = budgeted;

  // Mirrors the exact condition in draftPoFromPlan (src/actions/purchase.ts)
  // that decides whether to overwrite vs. fail outright on a status mismatch.
  const poPlanWillOverwrite = !!poPlan2027 && ["DRAFT", "CANCELLED"].includes(poPlan2027.status);
  const draftPoTitle = poPlanWillOverwrite ? "Replace PO-PLAN-2027's existing lines?" : "Draft PO from plan?";
  const draftPoDescription = !poPlan2027
    ? "Creates a new draft PO covering the OVERALL 2027 buy plan for the chosen supplier."
    : poPlanWillOverwrite
    ? `PO-PLAN-2027 already exists (${poPlan2027.status}) with ${poPlan2027.lines.length} line${poPlan2027.lines.length === 1 ? "" : "s"}. Confirming will DELETE ALL of those existing lines and REPLACE them with a freshly recomputed plan — possibly for a different supplier than it currently has. This cannot be undone.`
    : `PO-PLAN-2027 already exists and is ${poPlan2027.status} — it can't be overwritten this way. Receive it or raise a separate PO by hand.`;

  const rank = new Map<string, { sku: string; size: string; qty: number }>();
  for (const issue of issues) {
    const key = `${issue.sku.code}|${issue.size}`;
    const prev = rank.get(key) ?? { sku: issue.sku.code, size: issue.size, qty: 0 };
    prev.qty += issue.qty;
    rank.set(key, prev);
  }
  const hottest = [...rank.values()].sort((a, b) => b.qty - a.qty).slice(0, 12);

  const recentKeys = new Set(
    issues.filter((i) => i.createdAt >= cutoff).map((i) => `${i.skuId}|${i.size}`),
  );
  const dead = balances.filter((b) => b.qty > 0 && !recentKeys.has(`${b.skuId}|${b.size}`));

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Sizes & next-year buy"
        subtitle="Required = enrolment × pack. Order = required − campus − MAIN. Cost = order × buy."
        actions={
          <div className="flex gap-2">
            <a className="rounded-[10px] border border-card-border bg-white px-3 py-2 text-sm font-semibold text-electric-blue no-underline hover:bg-light-blue-30" href="/api/sizes/export">
              Export CSV
            </a>
            {canEdit ? (
            <form action={runForecast}>
              <input type="hidden" name="year" value="2027" />
              <Btn>Refresh buy plan</Btn>
            </form>
            ) : null}
          </div>
        }
      />
      <Card className={vs.fits ? "" : "border-gold"}>
        <h2 className="mb-2 font-semibold">Plan vs budget</h2>
        <p className="text-sm">
          City buy <Money amount={vs.orderCostTzs} /> · remaining budget <Money amount={vs.remainingBudgetTzs} />
          {vs.fits ? " · within budget" : <> · over by <Money amount={vs.overByTzs} /></>}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          MAIN covers {totals.mainCover} pieces before we buy. Budget left after open POs.
        </p>
      </Card>
      <Card>
        <h2 className="mb-2 font-semibold">Size fit by class</h2>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Typical size that fits each class and gender, per garment. Parents see the same chart in the app.
        </p>
        <Table headers={["Class", "Child", "Garment", "Size", "Fit note"]}>
          {fits.filter((f) => f.sku.kind === "SCHOOL").map((f) => (
            <tr key={f.id}>
              <td className="px-2 py-2">{f.className}</td>
              <td className="px-2 py-2">{f.gender === "GIRL" ? "Girl" : "Boy"}</td>
              <td className="px-2 py-2">{f.sku.code} {f.sku.name}</td>
              <td className="px-2 py-2">{f.size}</td>
              <td className="px-2 py-2 text-xs text-ink-muted">{f.note}</td>
            </tr>
          ))}
        </Table>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Hottest sizes</h2>
          <Table headers={["Rank", "SKU", "Size", "Issued"]}>
            {hottest.map((row, i) => (
              <tr key={`${row.sku}${row.size}`}>
                <td className="px-2 py-2">{i + 1}</td>
                <td className="px-2 py-2">{row.sku}</td>
                <td className="px-2 py-2">{row.size}</td>
                <td className="px-2 py-2">{row.qty}</td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Dead sizes</h2>
          <Table headers={["Location", "SKU", "Size", "Qty"]}>
            {dead.slice(0, 20).map((row) => (
              <tr key={row.id}>
                <td className="px-2 py-2">{row.location.code}</td>
                <td className="px-2 py-2">{row.sku.code}</td>
                <td className="px-2 py-2">{row.size}</td>
                <td className="px-2 py-2">{row.qty}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
      <Card>
        <h2 className="mb-2 font-semibold">OVERALL buy plan (2027)</h2>
        <p className="mb-3 text-sm text-[var(--muted)]">
          {campuses.map((c) => {
            const n = enrolment.filter((e) => e.campusId === c.id).reduce((s, e) => s + e.expectedHeadcount, 0);
            return `${c.name}: ${n}`;
          }).join(" · ")}
        </p>
        <p className="mb-3 text-sm">
          Required {totals.required} · On hand {totals.remaining} · MAIN {totals.mainCover} · Order {totals.orderQty} ·
          Buy <Money amount={totals.orderCostTzs} /> · If sold <Money amount={totals.orderSellTzs} /> ·
          Profit <Money amount={totals.profitTzs} />
        </p>
        {canEdit && suppliers.length ? (
          <div className="mb-4">
            <ConfirmModal
              triggerLabel="Draft PO from plan"
              triggerTone="primary"
              tone={poPlanWillOverwrite ? "danger" : "primary"}
              title={draftPoTitle}
              description={draftPoDescription}
              confirmLabel={poPlanWillOverwrite ? "Yes, replace it" : "Create draft PO"}
              action={draftPoFromPlan}
              hiddenFields={{ year: "2027" }}
            >
              <Field label="Supplier">
                <select className={inputClass()} name="supplierId">
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </Field>
            </ConfirmModal>
          </div>
        ) : null}
        <Table headers={["Campus", "SKU", "Size", "Required", "On hand", "MAIN", "Order", "Buy cost", "Profit"]}>
          {plan.filter((r) => r.orderQty > 0 || r.mainCover > 0).map((row) => (
            <tr key={`${row.campusId}${row.skuId}${row.size}`}>
              <td className="px-2 py-2">{row.campusName}</td>
              <td className="px-2 py-2">{row.skuCode}</td>
              <td className="px-2 py-2">{row.size}</td>
              <td className="px-2 py-2">{row.required}</td>
              <td className="px-2 py-2">{row.remaining}</td>
              <td className="px-2 py-2">{row.mainCover}</td>
              <td className="px-2 py-2">{row.orderQty}</td>
              <td className="px-2 py-2"><Money amount={row.orderCostTzs} /></td>
              <td className="px-2 py-2"><Money amount={row.profitTzs} /></td>
            </tr>
          ))}
        </Table>
        <p className="mt-2 text-xs text-ink-muted">
          Pack: 2× polo, 1× sweater, round-neck, tracksuit, skirt (girl) / trousers (boy). Method: {plan[0]?.method ?? "enrolment × pack − campus − MAIN"}.
        </p>
      </Card>
      <Card>
        <h2 className="mb-2 font-semibold">Enrolment</h2>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Heads per class. The buy plan below always uses {enrolmentYear} — planning a different year here saves it, but won&apos;t
          feed the buy plan until that becomes the active planning year.
        </p>
        {canEdit ? (
          <form action={saveEnrolment} className="grid gap-3">
            <Field label="Year">
              <input className={`${inputClass()} w-28`} name="year" type="number" defaultValue={enrolmentYear} required />
            </Field>
            <Table headers={["Campus", ...PRIMARY_CLASSES]}>
              {campuses.map((campus) => (
                <tr key={campus.id}>
                  <td className="px-2 py-2">{campus.name}</td>
                  {PRIMARY_CLASSES.map((className) => {
                    const row = enrolment.find((e) => e.campusId === campus.id && e.className === className);
                    return (
                      <td key={className} className="px-2 py-2">
                        <input type="hidden" name="campusId" value={campus.id} />
                        <input type="hidden" name="className" value={className} />
                        <input
                          className={`${inputClass()} w-20`}
                          name="heads"
                          type="number"
                          min={0}
                          defaultValue={row?.expectedHeadcount ?? 0}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Table>
            <Btn>Save enrolment</Btn>
          </form>
        ) : (
          <Table headers={["Campus", ...PRIMARY_CLASSES]}>
            {campuses.map((campus) => (
              <tr key={campus.id}>
                <td className="px-2 py-2">{campus.name}</td>
                {PRIMARY_CLASSES.map((className) => {
                  const row = enrolment.find((e) => e.campusId === campus.id && e.className === className);
                  return <td key={className} className="px-2 py-2">{row?.expectedHeadcount ?? "—"}</td>;
                })}
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Card>
        <h2 className="mb-2 font-semibold">Buy / sell prices</h2>
        <p className="mb-3 text-sm text-[var(--muted)]">Integer TZS. Polo buy should stay 11,000 unless the city quote changes.</p>
        {canEdit ? (
          <ConfirmModal
            triggerLabel="Save prices"
            triggerTone="primary"
            tone="danger"
            wide
            title="Update buy/sell prices for every SKU?"
            description="This rewrites the buy and sell price for every SKU shown below, network-wide, effective immediately for any new coupon or purchase order from this point on — a typo in one field hits every future transaction, not just one row. Double-check the table before confirming."
            confirmLabel="Yes, save these prices"
            action={savePrices}
          >
            <Table headers={["SKU", "Buy", "Sell"]}>
              {skus.map((sku) => (
                <tr key={sku.id}>
                  <td className="px-2 py-2">
                    <input type="hidden" name="skuId" value={sku.id} />
                    {sku.code} {sku.name}
                  </td>
                  <td className="px-2 py-2">
                    <input className={inputClass()} name="buyTzs" type="number" min={0} defaultValue={sku.buyTzs} />
                  </td>
                  <td className="px-2 py-2">
                    <input className={inputClass()} name="sellTzs" type="number" min={0} defaultValue={sku.sellTzs} />
                  </td>
                </tr>
              ))}
            </Table>
          </ConfirmModal>
        ) : (
          <Table headers={["SKU", "Buy", "Sell"]}>
            {skus.map((sku) => (
              <tr key={sku.id}>
                <td className="px-2 py-2">{sku.code} {sku.name}</td>
                <td className="px-2 py-2"><Money amount={sku.buyTzs} /></td>
                <td className="px-2 py-2"><Money amount={sku.sellTzs} /></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
