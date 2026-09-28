import Link from "next/link";
import { completeSewingJob, createSewingJob, deleteSewingJob, updateSewingJob } from "@/actions/sewing";
import {
  cancelMaterialRequest,
  fulfillMaterialRequest,
  priceAndForward,
  requestMaterials,
} from "@/actions/material-requests";
import { ConfirmModal } from "@/components/confirm-modal";
import { MaterialLinesEditor } from "@/components/material-lines-editor";
import { Badge, Btn, Card, Field, Money, Pager, PageHeader, SkuSizeFields, Table, inputClass, statusTone } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { pageCount, PAGE_SIZE, pageSkip, parsePage } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { sewingPnl } from "@/lib/sheet-math";

export default async function SewingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser(["TAILOR", "STORE"]);
  const page = parsePage((await searchParams).page);
  // Open jobs (not yet completed) drive the "stock in" action cards below —
  // fetched separately, unpaginated, since a job needs its card regardless of
  // how far back it falls on the history page. Naturally small: a job stays
  // "open" only until the tailor completes it.
  const [jobs, total, openJobs, skus, payees, matRequests] = await Promise.all([
    prisma.sewingJob.findMany({
      include: { sku: true, tailor: true, expenses: true },
      orderBy: { sewnOn: "desc" },
      skip: pageSkip(page),
      take: PAGE_SIZE,
    }),
    prisma.sewingJob.count(),
    prisma.sewingJob.findMany({
      where: { status: { not: "DONE" } },
      include: { sku: true },
      orderBy: { sewnOn: "asc" },
    }),
    prisma.sku.findMany({ where: { active: true }, include: { sizes: true }, orderBy: { code: "asc" } }),
    prisma.payee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.materialRequest.findMany({
      where: { status: { not: "CANCELLED" } },
      include: {
        lines: { include: { payee: true } },
        sewingJob: { include: { sku: true } },
        requestedBy: true,
        pricedBy: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Loveness"
        title="Daily sewing tracker"
        subtitle="Log the job, then complete it to put finished pieces into MAIN. P&L is city-buy replacement minus jora + labour."
        actions={
          <Link className="text-sm font-semibold text-electric-blue no-underline" href="/slm">
            Materials →
          </Link>
        }
      />
      <Card>
        <Table headers={["When", "Tailor", "SKU", "Size", "Note", "Expected", "Actual", "Status", "Materials", "Labour", "City-buy", "Sewn cost", "Saved"]}>
          {jobs.map((job) => {
            const materialLines = job.expenses.filter((e) => e.kind === "MATERIAL");
            const labourLines = job.expenses.filter((e) => e.kind === "LABOUR");
            const material = materialLines.reduce((s, e) => s + e.amountTzs, 0);
            const labour = labourLines.reduce((s, e) => s + e.amountTzs, 0);
            const pnl = job.status === "DONE" ? sewingPnl(job.actual, job.sku.buyTzs, material, labour) : null;
            return (
            <tr key={job.id}>
              <td className="px-2 py-2 text-xs">{job.sewnOn.toISOString().slice(0, 10)}</td>
              <td className="px-2 py-2">{job.tailor.name}</td>
              <td className="px-2 py-2">{job.sku.code}</td>
              <td className="px-2 py-2">{job.size}</td>
              <td className="px-2 py-2 text-xs text-ink-muted">{job.note || "—"}</td>
              <td className="px-2 py-2">{job.expected}</td>
              <td className="px-2 py-2">{job.actual}</td>
              <td className="px-2 py-2"><Badge tone={statusTone(job.status)}>{job.status}</Badge></td>
              <td className="px-2 py-2 text-xs">{materialLines.length ? materialLines.map((e) => e.note).join("; ") : "—"}</td>
              <td className="px-2 py-2 text-xs">{labourLines.length ? labourLines.map((e) => e.note).join("; ") : "—"}</td>
              <td className="px-2 py-2">{pnl ? <Money amount={pnl.replacementTzs} /> : "—"}</td>
              <td className="px-2 py-2">{pnl ? <Money amount={pnl.sewnCostTzs} /> : "—"}</td>
              <td className="px-2 py-2">{pnl ? <Money amount={pnl.savedTzs} /> : "—"}</td>
            </tr>
            );
          })}
        </Table>
        <Pager page={page} totalPages={pageCount(total)} />
      </Card>
      {user.role === "TAILOR" ? (
      <Card>
        <h2 className="mb-3 font-semibold">New job</h2>
        <form action={createSewingJob} className="grid gap-3 md:grid-cols-4">
          <SkuSizeFields
            showName
            skus={skus.map((s) => ({ id: s.id, code: s.code, name: s.name, sizes: s.sizes.map((x) => x.size) }))}
          />
          <Field label="Expected">
            <input className={inputClass()} name="expected" type="number" min={1} required />
          </Field>
          <Field label="Note">
            <input className={inputClass()} name="note" />
          </Field>
          <div className="md:col-span-4">
            <Btn>Add job</Btn>
          </div>
        </form>
      </Card>
      ) : null}
      {user.role === "TAILOR" ? openJobs.map((job) => (
        <Card key={job.id}>
          <h3 className="font-semibold">
            Complete {job.sku.code} {job.size} (expected {job.expected})
          </h3>
          <div className="mt-3">
            <ConfirmModal
              triggerLabel="Stock in"
              triggerTone="primary"
              tone="primary"
              title={`Mark ${job.sku.code} ${job.size} done?`}
              description="Moves the finished pieces into stock and consumes materials for it. This can't be undone from here — double-check the actual quantity before confirming."
              confirmLabel="Yes, stock it in"
              action={completeSewingJob}
              hiddenFields={{ jobId: job.id }}
            >
              <Field label="Actual quantity">
                <input className={inputClass()} name="actual" type="number" min={1} defaultValue={job.expected} />
              </Field>
            </ConfirmModal>
          </div>
          <div className="mt-2 flex gap-2">
            <ConfirmModal
              triggerLabel="Edit job"
              triggerTone="ghost"
              tone="primary"
              title={`Edit ${job.sku.code} ${job.size}`}
              description="Fix a wrong SKU, size, or expected quantity. Only works before the job is completed."
              confirmLabel="Save changes"
              action={updateSewingJob}
              hiddenFields={{ jobId: job.id }}
            >
              <SkuSizeFields
                showName
                skus={skus.map((s) => ({ id: s.id, code: s.code, name: s.name, sizes: s.sizes.map((x) => x.size) }))}
                initialSkuId={job.skuId}
                initialSize={job.size}
              />
              <Field label="Expected">
                <input className={inputClass()} name="expected" type="number" min={1} defaultValue={job.expected} />
              </Field>
            </ConfirmModal>
            <ConfirmModal
              triggerLabel="Delete job"
              triggerTone="danger"
              title="Delete this job?"
              description={`Removes the ${job.sku.code} ${job.size} job from the tracker. Nothing's been stocked in yet, so this is safe to undo a wrong entry. This can't be undone.`}
              confirmLabel="Yes, delete it"
              action={deleteSewingJob}
              hiddenFields={{ jobId: job.id }}
            />
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-semibold text-electric-blue">
              Request materials / labour for this job
            </summary>
            <form action={requestMaterials} className="mt-3 grid gap-3">
              <input type="hidden" name="sewingJobId" value={job.id} />
              <MaterialLinesEditor payees={payees.map((p) => ({ id: p.id, name: p.name, phone: p.phone }))} />
              <p className="text-xs text-ink-muted">
                Materials go to Imani for a real supplier price before Finance sees them. Labour needs your real rate now — no placeholders.
              </p>
              <Btn>Send to Imani</Btn>
            </form>
          </details>
        </Card>
      )) : null}

      {matRequests.length > 0 ? (
        <Card>
          <h2 className="mb-3 font-semibold">Materials &amp; labour requests</h2>
          <ul className="grid gap-4 text-sm">
            {matRequests.map((r) => {
              const total = r.lines.reduce((s, l) => s + l.qty * l.unitCostTzs, 0);
              const canCancel = r.status === "PENDING_STORE" || r.status === "PENDING_FINANCE";
              return (
                <li key={r.id} className="border-b border-card-border pb-3 last:border-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <strong>{r.ref}</strong> · {r.sewingJob.sku.code} {r.sewingJob.size} · by {r.requestedBy.name}
                      {r.pricedBy ? <> · priced by {r.pricedBy.name}</> : null}
                    </div>
                    <Badge
                      tone={
                        r.status === "FULFILLED"
                          ? "leaf"
                          : r.status === "APPROVED"
                            ? "blue"
                            : r.status === "REJECTED"
                              ? "red"
                              : "gold"
                      }
                    >
                      {r.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <ul className="mt-1 text-ink-muted">
                    {r.lines.map((l) => (
                      <li key={l.id}>
                        {l.kind === "LABOUR" ? "Labour" : l.materialKind} — {l.description} · {l.qty} {l.unit}
                        {l.unitCostTzs > 0 ? ` @ ${l.unitCostTzs.toLocaleString()} = ${(l.qty * l.unitCostTzs).toLocaleString()} TZS` : " · not yet priced"}
                        {l.payee ? ` · paid to ${l.payee.name}` : ""}
                      </li>
                    ))}
                  </ul>
                  {total > 0 ? <p className="mt-1 font-semibold">Total <Money amount={total} /></p> : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {user.role === "STORE" && r.status === "PENDING_STORE" ? (
                      <ConfirmModal
                        triggerLabel="Price & forward to Finance"
                        triggerTone="primary"
                        tone="primary"
                        wide
                        title={`Price ${r.ref} and send to Finance?`}
                        description="Call the supplier for a real price on each material line before forwarding — Finance sees these figures as final, not estimates."
                        confirmLabel="Forward to Finance"
                        action={priceAndForward}
                        hiddenFields={{ requestId: r.id }}
                      >
                        {r.lines.filter((l) => l.kind === "MATERIAL").map((l) => (
                          <Field key={l.id} label={`${l.description} (${l.qty} ${l.unit}) — real unit cost TZS`}>
                            <input
                              className={inputClass()}
                              name={`unitCostTzs_${l.id}`}
                              type="number"
                              min={1}
                              defaultValue={l.unitCostTzs || ""}
                              required
                            />
                          </Field>
                        ))}
                      </ConfirmModal>
                    ) : null}
                    {user.role === "STORE" && r.status === "APPROVED" ? (
                      <ConfirmModal
                        triggerLabel="Mark bought"
                        triggerTone="primary"
                        tone="primary"
                        title={`Post ${r.ref} as bought?`}
                        description={`Records the real MaterialBatch/expense rows for ${total.toLocaleString()} TZS using the already-approved figures.`}
                        confirmLabel="Yes, I've bought this"
                        action={fulfillMaterialRequest}
                        hiddenFields={{ requestId: r.id }}
                      />
                    ) : null}
                    {canCancel && (user.role === "STORE" || user.id === r.requestedById) ? (
                      <ConfirmModal
                        triggerLabel="Cancel"
                        triggerTone="danger"
                        title={`Cancel ${r.ref}?`}
                        description="Nothing gets bought against this request."
                        confirmLabel="Yes, cancel it"
                        action={cancelMaterialRequest}
                        hiddenFields={{ requestId: r.id }}
                      >
                        <Field label="Why?">
                          <input className={inputClass()} name="reason" placeholder="e.g. wrong quantity, re-submitting" required />
                        </Field>
                      </ConfirmModal>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
