import Link from "next/link";
import { createPayee, deactivatePayee, reactivatePayee, updatePayee } from "@/actions/payees";
import { createGarmentRecipe, updateGarmentRecipe } from "@/actions/recipes";
import { ConfirmModal } from "@/components/confirm-modal";
import { Badge, Btn, Card, Field, Money, Pager, PageHeader, SkuSizeFields, Table, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatQty, planMaterials, topMaterials } from "@/lib/materials";
import { pageCount, PAGE_SIZE, pageSkip, parsePage } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export default async function SlmPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser(["TAILOR", "STORE"]);
  const page = parsePage((await searchParams).page);
  // `materials` here is the full set — planMaterials() needs every batch to
  // compute correct remaining-cloth totals, not just one page of them.
  // `materialBatches`/`materialBatchTotal` below are the paginated slice
  // used only for the "material batches bought" history table.
  const [jobs, materials, materialBatches, materialBatchTotal, expenses, recipes, payees, skus] = await Promise.all([
    prisma.sewingJob.findMany({ include: { sku: true, materials: true, expenses: true } }),
    prisma.materialBatch.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.materialBatch.findMany({ orderBy: { createdAt: "desc" }, skip: pageSkip(page), take: PAGE_SIZE }),
    prisma.materialBatch.count(),
    prisma.expense.findMany({
      where: { kind: { in: ["MATERIAL", "LABOUR"] } },
      orderBy: { spentOn: "desc" },
    }),
    prisma.garmentRecipe.findMany({ include: { sku: true }, orderBy: [{ sku: { code: "asc" } }, { size: "asc" }] }),
    prisma.payee.findMany({ orderBy: { name: "asc" } }),
    prisma.sku.findMany({ where: { active: true }, include: { sizes: true }, orderBy: { code: "asc" } }),
  ]);
  const materialCost = expenses.filter((e) => e.kind === "MATERIAL").reduce((s, e) => s + e.amountTzs, 0);
  const labourCost = expenses.filter((e) => e.kind === "LABOUR").reduce((s, e) => s + e.amountTzs, 0);
  const output = jobs.reduce((s, j) => s + j.actual, 0);

  const openJobs = jobs.filter((j) => j.status !== "DONE");
  const plan = planMaterials(
    recipes.map((r) => ({
      skuId: r.skuId,
      skuCode: r.sku.code,
      skuName: r.sku.name,
      garmentKind: r.sku.kind,
      size: r.size,
      materialKind: r.materialKind,
      materialName: r.materialName,
      qtyPerPiece: r.qtyPerPiece,
      unit: r.unit,
    })),
    materials,
    openJobs.map((j) => ({
      skuId: j.skuId,
      skuCode: j.sku.code,
      skuName: j.sku.name,
      garmentKind: j.sku.kind,
      size: j.size,
      pieces: j.expected,
    })),
  );
  const short = plan.filter((p) => p.shortfall > 0).length;
  const mostBought = topMaterials(materials);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Cloth & SLM"
        subtitle="What you bought (actual), what is left, which garment/size eats which cloth, and how much you still need for open jobs."
        actions={
          <Link className="text-sm font-semibold text-electric-blue no-underline" href="/sewing">
            Sewing jobs →
          </Link>
        }
      />
      <div className="grid gap-4 md:grid-cols-4">
        <Card><p className="text-sm text-[var(--muted)]">Material cost</p><p className="text-2xl"><Money amount={materialCost} /></p></Card>
        <Card><p className="text-sm text-[var(--muted)]">Labour</p><p className="text-2xl"><Money amount={labourCost} /></p></Card>
        <Card><p className="text-sm text-[var(--muted)]">Finished pieces</p><p className="text-2xl">{output}</p></Card>
        <Card><p className="text-sm text-[var(--muted)]">Materials short</p><p className="text-2xl">{short}</p></Card>
      </div>

      <Card>
        <h2 className="mb-1 font-semibold">Bought vs need</h2>
        <p className="mb-3 text-sm text-ink-muted">
          Bought is the actual batch that landed. Remaining is leftover after completed jobs. Need is open sewing jobs × recipe for that size.
        </p>
        <Table headers={["Material", "Kind", "Bought", "Left", "Need (open jobs)", "Buy more"]}>
          {plan.map((row) => (
            <tr key={row.key} className={row.shortfall > 0 ? "bg-gold-15" : undefined}>
              <td className="px-2 py-2">{row.materialName}</td>
              <td className="px-2 py-2"><Badge tone="pink">{row.materialKind}</Badge></td>
              <td className="px-2 py-2">{formatQty(row.bought, row.unit)}</td>
              <td className="px-2 py-2">{formatQty(row.remaining, row.unit)}</td>
              <td className="px-2 py-2">{formatQty(row.needForJobs, row.unit)}</td>
              <td className="px-2 py-2">{row.shortfall > 0 ? formatQty(row.shortfall, row.unit) : "—"}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Most bought materials</h2>
        <p className="mb-3 text-sm text-ink-muted">
          All-time totals across every batch ever bought, ranked by quantity — not just what&apos;s recent.
        </p>
        {mostBought.length > 0 ? (
          <Table headers={["Material", "Kind", "Total bought", "Total spent"]}>
            {mostBought.map((row) => (
              <tr key={`${row.kind}-${row.description}`}>
                <td className="px-2 py-2">{row.description}</td>
                <td className="px-2 py-2"><Badge tone="pink">{row.kind}</Badge></td>
                <td className="px-2 py-2">{formatQty(row.qty, row.unit)}</td>
                <td className="px-2 py-2"><Money amount={row.costTzs} /></td>
              </tr>
            ))}
          </Table>
        ) : (
          <p className="text-sm text-ink-muted">Nothing bought yet.</p>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Size → cloth</h2>
        <p className="mb-3 text-sm text-ink-muted">
          For each open job: garment type, size, material, metres per piece, and total needed.
        </p>
        <Table headers={["Cloth", "Garment", "Type", "Size", "Pieces", "Per piece", "Need"]}>
          {plan.flatMap((row) =>
            row.garments.map((g) => (
              <tr key={`${row.key}-${g.skuCode}-${g.size}`}>
                <td className="px-2 py-2">{row.materialName}</td>
                <td className="px-2 py-2">{g.skuCode} {g.skuName}</td>
                <td className="px-2 py-2">{g.garmentKind === "BOARDING" ? "Boarding" : "Day"}</td>
                <td className="px-2 py-2">{g.size}</td>
                <td className="px-2 py-2">{g.pieces}</td>
                <td className="px-2 py-2">{formatQty(g.qtyPerPiece, "cm")}</td>
                <td className="px-2 py-2">{formatQty(g.need, "cm")}</td>
              </tr>
            )),
          )}
        </Table>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Recipes (cloth per piece)</h2>
        <p className="mb-3 text-sm text-ink-muted">
          What every completed piece actually consumes — drives both the material-need math above and stock deduction when a job is stocked in.
          The material name has to match a batch&apos;s description exactly for the FIFO consumption to find it.
        </p>
        <Table headers={["SKU", "Size", "Material", "Kind", "Per piece", ""]}>
          {recipes.map((r) => (
            <tr key={r.id}>
              <td className="px-2 py-2">{r.sku.code} {r.sku.name}</td>
              <td className="px-2 py-2">{r.size}</td>
              <td className="px-2 py-2">{r.materialName}</td>
              <td className="px-2 py-2"><Badge tone="pink">{r.materialKind}</Badge></td>
              <td className="px-2 py-2">{formatQty(r.qtyPerPiece, r.unit)}</td>
              <td className="px-2 py-2 text-right">
                <ConfirmModal
                  triggerLabel="Edit"
                  triggerTone="ghost"
                  tone="primary"
                  title={`Edit ${r.sku.code} ${r.size} recipe?`}
                  description="Fix the material name or quantity per piece. The SKU and size a recipe applies to can't change here — add a new recipe instead if this was for the wrong garment/size."
                  confirmLabel="Save changes"
                  action={updateGarmentRecipe}
                  hiddenFields={{ recipeId: r.id }}
                >
                  <Field label="Material name (must match a batch description)">
                    <input className={inputClass()} name="materialName" defaultValue={r.materialName} required />
                  </Field>
                  <Field label={`Qty per piece (${r.unit})`}>
                    <input className={inputClass()} name="qtyPerPiece" type="number" min={1} defaultValue={r.qtyPerPiece} required />
                  </Field>
                  <Field label="Unit">
                    <input className={inputClass()} name="unit" defaultValue={r.unit} required />
                  </Field>
                </ConfirmModal>
              </td>
            </tr>
          ))}
        </Table>
        <form action={createGarmentRecipe} className="mt-4 grid gap-3 md:grid-cols-4">
          <SkuSizeFields showName skus={skus.map((s) => ({ id: s.id, code: s.code, name: s.name, sizes: s.sizes.map((x) => x.size) }))} />
          <Field label="Material kind">
            <select className={inputClass()} name="materialKind">
              <option>FABRIC</option>
              <option>JORA</option>
              <option>SUPPLY</option>
            </select>
          </Field>
          <Field label="Material name">
            <input className={inputClass()} name="materialName" required placeholder="Light-blue polo fabric" />
          </Field>
          <Field label="Qty per piece">
            <input className={inputClass()} name="qtyPerPiece" type="number" min={1} required />
          </Field>
          <Field label="Unit">
            <input className={inputClass()} name="unit" defaultValue="cm" required />
          </Field>
          <div className="md:col-span-4">
            <Btn>Add recipe</Btn>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Material batches (actual bought)</h2>
        <Table headers={["Kind", "Description", "Bought", "Left", "Paid", "Job"]}>
          {materialBatches.map((m) => (
            <tr key={m.id}>
              <td className="px-2 py-2"><Badge tone="pink">{m.kind}</Badge></td>
              <td className="px-2 py-2">{m.description}</td>
              <td className="px-2 py-2">{formatQty(m.qty, m.unit)}</td>
              <td className="px-2 py-2">{formatQty(m.remaining, m.unit)}</td>
              <td className="px-2 py-2"><Money amount={m.qty * m.unitCostTzs} /></td>
              <td className="px-2 py-2 text-xs">{m.sewingJobId?.slice(-6) ?? "—"}</td>
            </tr>
          ))}
        </Table>
        <Pager page={page} totalPages={pageCount(materialBatchTotal)} />
      </Card>
      {user.role === "TAILOR" ? (
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <p className="mb-3 text-sm text-ink-muted">
            Material and labour costs are no longer logged directly here — request them against a specific job on the{" "}
            <Link className="underline" href="/sewing">Sewing</Link> page, where Imani prices materials with a real
            supplier quote and Finance approves before anything's bought.
          </p>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Payees</h2>
          <p className="mb-3 text-sm text-ink-muted">
            Casual/subcontracted tailors paid per piece — a real record to pick from above, instead of typing a name fresh each time.
          </p>
          {payees.length === 0 ? (
            <p className="mb-3 text-sm text-ink-muted">No payees yet.</p>
          ) : (
            <ul className="mb-3 grid gap-1 text-sm">
              {payees.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className={p.active ? "" : "text-ink-muted line-through"}>
                    {p.name}
                    {p.phone ? ` · ${p.phone}` : ""}
                    {p.payNote ? ` · ${p.payNote}` : ""}
                  </span>
                  <div className="flex gap-2">
                    {p.active ? (
                      <>
                        <ConfirmModal
                          triggerLabel="Edit"
                          triggerTone="ghost"
                          tone="primary"
                          title={`Edit ${p.name}'s contact details?`}
                          description="Fix a wrong phone number or pay note. The name itself can't change here — past expenses always show the name as recorded, so a typo'd name needs a fresh payee instead."
                          confirmLabel="Save changes"
                          action={updatePayee}
                          hiddenFields={{ payeeId: p.id }}
                        >
                          <Field label="Phone">
                            <input className={inputClass()} name="phone" defaultValue={p.phone} />
                          </Field>
                          <Field label="Pay note">
                            <input className={inputClass()} name="payNote" defaultValue={p.payNote} />
                          </Field>
                        </ConfirmModal>
                        <ConfirmModal
                          triggerLabel="Deactivate"
                          triggerTone="ghost"
                          tone="danger"
                          title={`Deactivate ${p.name}?`}
                          description="Hides them from the payee picker going forward. Past labour expenses already recorded against them are untouched."
                          confirmLabel="Yes, deactivate"
                          action={deactivatePayee}
                          hiddenFields={{ payeeId: p.id }}
                        />
                      </>
                    ) : (
                      <ConfirmModal
                        triggerLabel="Reactivate"
                        triggerTone="ghost"
                        tone="primary"
                        title={`Reactivate ${p.name}?`}
                        description="Makes them selectable again in the payee picker."
                        confirmLabel="Yes, reactivate"
                        action={reactivatePayee}
                        hiddenFields={{ payeeId: p.id }}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <form action={createPayee} className="grid gap-3">
            <Field label="Name">
              <input className={inputClass()} name="name" required placeholder="Elisa" />
            </Field>
            <Field label="Phone (optional)">
              <input className={inputClass()} name="phone" placeholder="0756 210249" />
            </Field>
            <Field label="Pay note (optional)">
              <input className={inputClass()} name="payNote" placeholder="Airtel Money, account under a different name" />
            </Field>
            <Btn>Add payee</Btn>
          </form>
        </Card>
      </div>
      ) : null}
    </div>
  );
}
