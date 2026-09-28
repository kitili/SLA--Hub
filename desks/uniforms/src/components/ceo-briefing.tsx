import type { ReactNode } from "react";
import Link from "next/link";
import { CampusFilter } from "@/components/campus-filter";
import {
  CHART,
  DonutChart,
  Gauge,
  HBars,
  Legend,
  PieChart,
  StackedHBars,
  VBars,
} from "@/components/charts";
import { PrintBtn } from "@/components/print-btn";
import { Badge, Card, Money, PageHeader, Table } from "@/components/ui";
import { WeekPackActions } from "@/components/week-pack";
import { weeklyPack } from "@/lib/briefing";
import { pct, type CampusKpi, type KpiReport } from "@/lib/kpis";
import { tzs } from "@/lib/money";

const PIPE_COLORS: Record<string, string> = {
  ORDERED: CHART.blue,
  PAID: CHART.gold,
  PARTIAL: CHART.navyLight,
  FULFILLED: CHART.green,
};

export function CeoBriefing({
  report,
  sites,
  canDrill,
}: {
  report: KpiReport;
  sites: { code: string; name: string }[];
  canDrill: boolean;
}) {
  const margin = report.issuedRevenueTzs - report.issuedCostTzs;
  const asOf = report.asOf.toISOString().slice(0, 10);
  const pack = weeklyPack(report);
  const briefingHref = report.campusCode ? `/briefing?campus=${report.campusCode}` : "/briefing";
  const stillNeed = Math.max(0, (report.enrolled || report.onFile) - report.withKit);
  const pipeline = report.pipeline.map((p) => ({
    label: p.status,
    value: p.count,
    color: PIPE_COLORS[p.status] ?? CHART.silver,
  }));
  const cash = [
    { label: "Collected", value: report.paymentsTzs, color: CHART.green },
    { label: "Outstanding", value: report.outstandingTzs, color: CHART.gold },
  ];
  const issuedMix = [
    { label: "Cost", value: report.issuedCostTzs, color: CHART.silver },
    { label: "Margin", value: Math.max(0, margin), color: CHART.navy },
  ];
  const campusColors = [CHART.navy, CHART.navyLight, CHART.blue, CHART.gold, CHART.green];

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={report.campusName ? `Leadership · ${report.campusName}` : "Leadership · five campuses"}
        title="Leadership briefing"
        subtitle={`Kit coverage, cash, and campus risk. ${asOf}. Read-only — Imani and campus desks still run the work.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <WeekPackActions text={pack} href={briefingHref} />
            <PrintBtn>Print charts</PrintBtn>
            <Link className="rounded-[10px] border border-card-border bg-white px-3.5 py-2 text-sm font-semibold text-electric-blue no-underline hover:bg-light-blue-30 no-print" href="/finance">
              Money
            </Link>
            <Link className="rounded-[10px] border border-card-border bg-white px-3.5 py-2 text-sm font-semibold text-electric-blue no-underline hover:bg-light-blue-30 no-print" href="/analytics">
              Year-end
            </Link>
          </div>
        }
      />

      {canDrill ? <CampusFilter sites={sites} active={report.campusCode} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Parent payments" value={<Money amount={report.paymentsTzs} />} hint={`${report.payRate}% of coupon value collected`} />
        <Stat label="Outstanding" value={<Money amount={report.outstandingTzs} />} hint={`${report.unpaidCoupons} unpaid · ${report.paidWaiting} paid waiting`} />
        <Stat label="Issued margin" value={<Money amount={margin} />} hint={`${pct(margin, report.issuedRevenueTzs)}% on issued pieces`} />
        <Link className="no-underline" href="/stock/value">
          <Stat label="Current stock value" value={<Money amount={report.stockValueTzs} />} hint={`${report.onHand} pieces across all locations · View detail`} />
        </Link>
        <Stat
          label="Kit coverage"
          value={`${report.coveragePct}%`}
          hint={`${report.withKit} of ${report.enrolled || report.onFile} planned children have a piece`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="mb-3 font-semibold">Kit coverage</h2>
          <div className="flex flex-wrap items-center gap-4">
            <DonutChart
              slices={[
                { label: "Have a piece", value: report.withKit, color: CHART.green },
                { label: "Still need", value: stillNeed, color: CHART.gold },
              ]}
              label={`${report.coveragePct}%`}
              sub="of planned children"
            />
            <Legend
              slices={[
                { label: "Have a piece", value: report.withKit, color: CHART.green },
                { label: "Still need", value: stillNeed, color: CHART.gold },
              ]}
            />
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            2027 enrolment plan {report.enrolled} · children on file {report.onFile}
          </p>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Coupon mix</h2>
          <div className="flex flex-wrap items-center gap-4">
            <DonutChart slices={pipeline} label={String(report.openCoupons + report.fulfilled)} sub="coupons" />
            <Legend slices={pipeline} />
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Cash collected</h2>
          <div className="flex flex-wrap items-center gap-4">
            <PieChart slices={cash} />
            <Legend slices={cash} format={(n) => tzs(n)} />
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Collected <Money amount={report.paymentsTzs} /> · outstanding <Money amount={report.outstandingTzs} />
          </p>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Pay vs fill</h2>
          <div className="grid grid-cols-2 gap-2">
            <Gauge value={report.payRate} label="Paid of order value" />
            <Gauge value={report.fillRate} label="Pieces issued" />
          </div>
        </Card>
      </div>

      {report.campuses.length > 1 ? (
        <Card>
          <h2 className="mb-3 font-semibold">Coverage by campus</h2>
          <HBars
            rows={report.campuses.map((c, i) => ({
              label: c.name,
              value: c.coveragePct,
              color: [CHART.navy, CHART.navyLight, CHART.blue, CHART.gold, CHART.green][i % 5],
            }))}
            format={(n) => `${n}%`}
          />
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-1 font-semibold">Money by campus</h2>
          <p className="mb-4 text-sm text-ink-muted">Green is paid in. Gold is still owed.</p>
          <StackedHBars
            rows={report.campuses.map((c) => ({ label: c.name, a: c.paymentsTzs, b: c.outstandingTzs }))}
            aLabel="Paid"
            bLabel="Outstanding"
            format={(n) => tzs(n)}
          />
        </Card>
        <Card>
          <h2 className="mb-1 font-semibold">Issued sale mix</h2>
          <p className="mb-4 text-sm text-ink-muted">Buy cost vs margin on pieces already handed over.</p>
          <div className="flex flex-wrap items-center gap-4">
            <DonutChart slices={issuedMix} label={tzs(margin)} sub="margin" size={150} />
            <Legend slices={issuedMix} format={(n) => tzs(n)} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Coupons by campus</h2>
          <VBars
            rows={report.campuses.map((c, i) => ({
              label: c.name.replace("Arusha Town (AM)", "AM"),
              value: c.coupons,
              color: campusColors[i % campusColors.length],
            }))}
          />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Low sizes by campus</h2>
          <VBars
            rows={report.campuses.map((c, i) => ({
              label: c.name.replace("Arusha Town (AM)", "AM"),
              value: c.lowSizes,
              color: c.lowSizes > 0 ? CHART.red : campusColors[i % campusColors.length],
            }))}
          />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Issued sizes</h2>
          {report.hottest.length ? (
            <HBars
              rows={report.hottest.map((row, i) => ({
                label: `${row.sku} ${row.size}`,
                value: row.qty,
                color: campusColors[i % campusColors.length],
              }))}
            />
          ) : (
            <p className="text-sm text-ink-muted">No issues yet.</p>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Pieces on hand</h2>
          <HBars
            rows={report.campuses.map((c, i) => ({
              label: c.name,
              value: c.onHand,
              color: campusColors[i % campusColors.length],
            }))}
          />
        </Card>
      </div>

      {report.attention.length ? (
        <Card>
          <h2 className="mb-3 font-semibold">Needs a decision</h2>
          <ul className="grid gap-2">
            {report.attention.map((item) => (
              <li key={item.title} className="flex flex-wrap items-start gap-2 text-sm">
                <Badge tone={item.tone}>{item.title}</Badge>
                <span className="text-ink-muted">{item.detail}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {report.topPurchasedSkus.length || report.topSuppliers.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 font-semibold">Top purchased SKUs</h2>
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
            <h2 className="mb-3 font-semibold">Top suppliers</h2>
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

      <Card>
        <h2 className="mb-3 font-semibold">Campus scorecard</h2>
        <p className="mb-3 text-sm text-ink-muted">Click a campus to open that site’s briefing.</p>
        <ScoreTable rows={report.campuses} drill={canDrill && report.campuses.length > 1} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Waiting on parents</h2>
          {report.readyList.length ? (
            <Table headers={["Coupon", "Child", "Campus", "Days waiting"]}>
              {report.readyList.map((row) => (
                <tr key={row.ref}>
                  <td className="px-2 py-2">
                    <Link className="font-semibold text-electric-blue no-underline" href={`/orders?q=${encodeURIComponent(row.ref)}`}>
                      {row.ref}
                    </Link>
                  </td>
                  <td className="px-2 py-2">{row.studentName}</td>
                  <td className="px-2 py-2">{row.campusName}</td>
                  <td className="px-2 py-2">{row.days}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <p className="text-sm text-ink-muted">No paid kits waiting to be collected.</p>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Aging coupons</h2>
          {report.aging.length ? (
            <Table headers={["Coupon", "Child", "Campus", "Status", "Days"]}>
              {report.aging.map((row) => (
                <tr key={row.ref}>
                  <td className="px-2 py-2">{row.ref}</td>
                  <td className="px-2 py-2">{row.studentName}</td>
                  <td className="px-2 py-2">{row.campusName}</td>
                  <td className="px-2 py-2"><Badge tone={row.ready ? "gold" : "blue"}>{row.status}</Badge></td>
                  <td className="px-2 py-2">{row.days}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <p className="text-sm text-ink-muted">No open coupons older than two weeks.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-electric-blue">{value}</p>
      <p className="mt-1 text-xs text-ink-muted">{hint}</p>
    </Card>
  );
}

function ScoreTable({ rows, drill }: { rows: CampusKpi[]; drill: boolean }) {
  return (
    <Table headers={["Campus", "Coverage", "Coupons", "Ready", "Issued", "Low", "Paid", "Outstanding"]}>
      {rows.map((row) => (
        <tr key={row.id}>
          <td className="px-2 py-2 font-semibold">
            {drill ? (
              <Link className="text-electric-blue no-underline" href={`/reports?campus=${row.code}`}>
                {row.name}
              </Link>
            ) : (
              row.name
            )}
          </td>
          <td className="px-2 py-2">{row.coveragePct}%</td>
          <td className="px-2 py-2">{row.coupons}</td>
          <td className="px-2 py-2">{row.ready}</td>
          <td className="px-2 py-2">{row.issuedPcs}</td>
          <td className="px-2 py-2">{row.lowSizes}</td>
          <td className="px-2 py-2"><Money amount={row.paymentsTzs} /></td>
          <td className="px-2 py-2"><Money amount={row.outstandingTzs} /></td>
        </tr>
      ))}
    </Table>
  );
}
