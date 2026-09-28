import type { ReactNode } from "react";
import Link from "next/link";
import { CHART, DonutChart, Gauge, HBars, Legend, PieChart, VBars } from "@/components/charts";
import { CeoBriefing } from "@/components/ceo-briefing";
import { PrintBtn } from "@/components/print-btn";
import { Badge, Card, Money, PageHeader, Table } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { CampusFilter } from "@/components/campus-filter";
import { buildKpiReport, campusIdForCode, listCampuses, type CampusKpi } from "@/lib/kpis";
import { isSchoolAdmin, schoolScope } from "@/lib/campus-scope";
import { isExecutive } from "@/lib/roles";

const REPORT_ROLES = ["STORE", "FINANCE", "CEO", "ADMIN", "HEAD_TEACHER", "PRINCIPAL"] as const;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ campus?: string }>;
}) {
  const user = await requireUser([...REPORT_ROLES]);
  const { campus: campusCode } = await searchParams;
  const campusOnly = Boolean(user.campusId) && (user.role === "ADMIN" || user.role === "HEAD_TEACHER" || user.role === "PRINCIPAL");
  const schoolAdmin = isSchoolAdmin(user);
  const canDrill = !campusOnly;
  const picked = schoolAdmin ? await schoolScope(user) : canDrill ? await campusIdForCode(campusCode) : null;
  const includeMoney = user.role === "STORE" || user.role === "FINANCE" || user.role === "CEO" || campusOnly || schoolAdmin;
  const includeProduction = user.role === "STORE" || user.role === "FINANCE" || user.role === "CEO";
  const [report, sites] = await Promise.all([
    buildKpiReport({
      campusId: campusOnly ? user.campusId : picked?.id,
      includeMoney,
      includeProduction,
    }),
    listCampuses(),
  ]);

  if (isExecutive(user.role)) {
    return <CeoBriefing report={report} sites={sites} canDrill={canDrill} />;
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={report.campusName ? report.campusName : "Network"}
        title="KPI reports"
        subtitle={
          report.campusName
            ? "Live coupons, collection, stock, and money for this campus."
            : "Live coupons, collection, stock, sewing, and money across five campuses."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <PrintBtn />
            {includeProduction ? (
              <Link className="rounded-[10px] border border-card-border bg-white px-3.5 py-2 text-sm font-semibold text-electric-blue no-underline hover:bg-light-blue-30 no-print" href="/analytics">
                Year-end
              </Link>
            ) : null}
          </div>
        }
      />

      {canDrill ? (
        <CampusFilter
          sites={sites}
          active={picked?.code ?? report.campusCode}
          persist={schoolAdmin}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open coupons" value={String(report.openCoupons)} hint={`${report.unpaidCoupons} unpaid · ${report.paidWaiting} paid waiting`} />
        <Stat label="Ready to collect" value={String(report.readyToCollect)} hint="Paid kits marked ready, not issued" />
        <Stat label="Kit coverage" value={`${report.coveragePct}%`} hint={`${report.withKit} of ${report.enrolled || report.onFile} planned children`} />
        <Stat label="Low sizes" value={String(report.lowSizes)} hint={`${report.onHand} pieces on hand`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="mb-3 font-semibold">Coupon pipeline</h2>
          <div className="flex flex-wrap items-center gap-4">
            <DonutChart
              slices={report.pipeline.map((p) => ({
                label: p.status,
                value: p.count,
                color: p.status === "FULFILLED" ? CHART.green : p.status === "PAID" ? CHART.gold : p.status === "PARTIAL" ? CHART.navyLight : CHART.blue,
              }))}
              label={String(report.openCoupons + report.fulfilled)}
              sub="coupons"
            />
            <Legend
              slices={report.pipeline.map((p) => ({
                label: p.status,
                value: p.count,
                color: p.status === "FULFILLED" ? CHART.green : p.status === "PAID" ? CHART.gold : p.status === "PARTIAL" ? CHART.navyLight : CHART.blue,
              }))}
            />
          </div>
        </Card>
        {includeMoney ? (
          <Card>
            <h2 className="mb-3 font-semibold">Cash vs outstanding</h2>
            <div className="flex flex-wrap items-center gap-4">
              <PieChart
                slices={[
                  { label: "Collected", value: report.paymentsTzs, color: CHART.green },
                  { label: "Outstanding", value: report.outstandingTzs, color: CHART.gold },
                ]}
              />
              <div className="grid gap-3">
                <Mini label="Parent payments" value={<Money amount={report.paymentsTzs} />} />
                <Mini label="Outstanding" value={<Money amount={report.outstandingTzs} />} />
                <Mini label="Issued margin" value={<Money amount={report.issuedRevenueTzs - report.issuedCostTzs} />} />
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <h2 className="mb-3 font-semibold">Stock</h2>
            <p className="text-3xl font-extrabold text-electric-blue">{report.onHand}</p>
            <p className="text-sm text-ink-muted">Pieces on campus · {report.lowSizes} at or below reorder</p>
          </Card>
        )}
        <Card>
          <h2 className="mb-3 font-semibold">Rates</h2>
          <div className="grid grid-cols-2 gap-2">
            <Gauge value={report.payRate} label="Paid" />
            <Gauge value={report.fillRate} label="Issued" />
          </div>
        </Card>
      </div>

      {report.campuses.length > 1 ? (
        <Card>
          <h2 className="mb-3 font-semibold">Coupons by campus</h2>
          <VBars
            rows={report.campuses.map((c, i) => ({
              label: c.name.replace("Arusha Town (AM)", "AM"),
              value: c.coupons,
              color: [CHART.navy, CHART.navyLight, CHART.blue, CHART.gold, CHART.green][i % 5],
            }))}
          />
        </Card>
      ) : null}

      {includeProduction ? (
        <Card>
          <h2 className="mb-2 font-semibold">Production</h2>
          <p className="text-sm">
            Sewing jobs open: <strong>{report.sewingOpen}</strong> · Sewn into stock: <strong>{report.sewnPcs}</strong> · Cloth shortfalls: <strong>{report.clothShortfalls}</strong>
          </p>
        </Card>
      ) : null}

      {report.campuses.length ? <CampusTable rows={report.campuses} money={includeMoney} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Ready — come collect</h2>
          {report.readyList.length ? (
            <Table headers={["Coupon", "Child", "Campus", "Days", "Balance"]}>
              {report.readyList.map((row) => (
                <tr key={row.ref}>
                  <td className="px-2 py-2"><Link className="font-semibold text-electric-blue no-underline" href={`/orders?q=${encodeURIComponent(row.ref)}`}>{row.ref}</Link></td>
                  <td className="px-2 py-2">{row.studentName}</td>
                  <td className="px-2 py-2">{row.campusName}</td>
                  <td className="px-2 py-2">{row.days}</td>
                  <td className="px-2 py-2"><Money amount={row.outstandingTzs} /></td>
                </tr>
              ))}
            </Table>
          ) : (
            <p className="text-sm text-ink-muted">No paid kits waiting at the window.</p>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Aging coupons (14+ days)</h2>
          {report.aging.length ? (
            <Table headers={["Coupon", "Child", "Status", "Days"]}>
              {report.aging.map((row) => (
                <tr key={row.ref}>
                  <td className="px-2 py-2">{row.ref}</td>
                  <td className="px-2 py-2">{row.studentName}</td>
                  <td className="px-2 py-2"><Badge tone={row.ready ? "gold" : "blue"}>{row.status}</Badge></td>
                  <td className="px-2 py-2">{row.days}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <p className="text-sm text-ink-muted">No coupons older than two weeks still open.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Hottest sizes</h2>
          {report.hottest.length ? (
            <HBars
              rows={report.hottest.map((row, i) => ({
                label: `${row.sku} ${row.size}`,
                value: row.qty,
                color: [CHART.navy, CHART.navyLight, CHART.blue, CHART.gold, CHART.green][i % 5],
              }))}
            />
          ) : (
            <p className="text-sm text-ink-muted">No issues yet — hottest sizes appear after handover.</p>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Dead stock</h2>
          {report.dead.length ? (
            <Table headers={["Location", "SKU", "Size", "Qty"]}>
              {report.dead.map((row) => (
                <tr key={`${row.location}${row.sku}${row.size}`}>
                  <td className="px-2 py-2">{row.location}</td>
                  <td className="px-2 py-2">{row.sku}</td>
                  <td className="px-2 py-2">{row.size}</td>
                  <td className="px-2 py-2">{row.qty}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <p className="text-sm text-ink-muted">No sitting sizes with stock and no issues in 90 days.</p>
          )}
        </Card>
      </div>

      {report.topPurchasedSkus.length || report.topSuppliers.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-1 font-semibold">Top purchased SKUs</h2>
            <p className="mb-3 text-sm text-ink-muted">
              All-time totals from received PO lines — cancelled orders and not-yet-arrived quantities don&apos;t count.
            </p>
            {report.topPurchasedSkus.length ? (
              <Table headers={["SKU", "Size", "Qty received", "Spent"]}>
                {report.topPurchasedSkus.map((row) => (
                  <tr key={`${row.sku}${row.size}`}>
                    <td className="px-2 py-2">{row.sku}</td>
                    <td className="px-2 py-2">{row.size}</td>
                    <td className="px-2 py-2">{row.qty}</td>
                    <td className="px-2 py-2"><Money amount={row.costTzs} /></td>
                  </tr>
                ))}
              </Table>
            ) : (
              <p className="text-sm text-ink-muted">Nothing received yet.</p>
            )}
          </Card>
          <Card>
            <h2 className="mb-1 font-semibold">Top suppliers</h2>
            <p className="mb-3 text-sm text-ink-muted">Ranked by total spent, across every non-cancelled PO.</p>
            {report.topSuppliers.length ? (
              <Table headers={["Supplier", "POs", "Qty received", "Spent"]}>
                {report.topSuppliers.map((row) => (
                  <tr key={row.supplierName}>
                    <td className="px-2 py-2">{row.supplierName}</td>
                    <td className="px-2 py-2">{row.poCount}</td>
                    <td className="px-2 py-2">{row.receivedQty}</td>
                    <td className="px-2 py-2"><Money amount={row.costTzs} /></td>
                  </tr>
                ))}
              </Table>
            ) : (
              <p className="text-sm text-ink-muted">Nothing received yet.</p>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint: string;
}) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-electric-blue">{value}</p>
      <p className="mt-1 text-xs text-ink-muted">{hint}</p>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="text-lg font-semibold text-electric-blue">{value}</p>
    </div>
  );
}

function CampusTable({ rows, money }: { rows: CampusKpi[]; money: boolean }) {
  return (
    <Card>
      <h2 className="mb-3 font-semibold">{rows.length > 1 ? "By campus" : "This campus"}</h2>
      <Table
        headers={
          money
            ? ["Campus", "Coupons", "Paid wait", "Ready", "Issued", "On hand", "Low", "Paid", "Outstanding"]
            : ["Campus", "Coupons", "Paid wait", "Ready", "Issued", "On hand", "Low"]
        }
      >
        {rows.map((row) => (
          <tr key={row.id}>
            <td className="px-2 py-2 font-semibold">{row.name}</td>
            <td className="px-2 py-2">{row.coupons}</td>
            <td className="px-2 py-2">{row.paidWaiting}</td>
            <td className="px-2 py-2">{row.ready}</td>
            <td className="px-2 py-2">{row.issuedPcs}</td>
            <td className="px-2 py-2">{row.onHand}</td>
            <td className="px-2 py-2">{row.lowSizes}</td>
            {money ? (
              <>
                <td className="px-2 py-2"><Money amount={row.paymentsTzs} /></td>
                <td className="px-2 py-2"><Money amount={row.outstandingTzs} /></td>
              </>
            ) : null}
          </tr>
        ))}
      </Table>
    </Card>
  );
}
