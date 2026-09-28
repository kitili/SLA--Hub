"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PnLReport } from "@/lib/db/finance";
import { DashboardExportButton } from "@/components/admin/DashboardExportButton";
import { DonutChart } from "@/components/charts/DonutChart";
import { GaugeChart } from "@/components/charts/GaugeChart";
import { HorizontalBarChart } from "@/components/charts/HorizontalBarChart";
import { PillBarChart } from "@/components/charts/PillBarChart";
import { SmoothAreaChart } from "@/components/charts/SmoothAreaChart";
import { SparklineMetricCard } from "@/components/charts/SparklineMetricCard";
import { pctChange } from "@/components/charts/path";

type BoardingDay = {
  date: string;
  count: number;
  timeIn?: number;
  timeOut?: number;
};

type SchoolOption = { id: string; name: string; slug: string };

type Props = {
  initialPnL: PnLReport;
  boardingTrend: BoardingDay[];
  defaultFrom: string;
  defaultTo: string;
  schools: SchoolOption[];
  /** Fleet-wide, not affected by the campus filter below -- see cost-metrics.ts. */
  fleetDistanceKm: number;
  totalStudents: number;
};

function money(currency: string, amount: number) {
  return `${currency} ${Math.round(amount).toLocaleString()}`;
}

function shortLabel(key: string) {
  return key.replaceAll("_", " ");
}

const PALETTE = [
  "#002368",
  "#80bfec",
  "#ffc952",
  "#167a37",
  "#003a8c",
  "#5a8eb8",
];

export function FinancePnLPanel({
  initialPnL,
  boardingTrend,
  defaultFrom,
  defaultTo,
  schools,
  fleetDistanceKm,
  totalStudents,
}: Props) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [schoolId, setSchoolId] = useState("");
  const [pnl, setPnl] = useState(initialPnL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextFrom: string, nextTo: string, nextSchoolId: string) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ from: nextFrom, to: nextTo });
        if (nextSchoolId) qs.set("schoolId", nextSchoolId);
        const res = await fetch(`/api/finance/pnl?${qs.toString()}`);
        const data = (await res.json()) as { pnl?: PnLReport; error?: string };
        if (!res.ok || !data.pnl) {
          setError(data.error ?? `P&L failed (${res.status})`);
          return;
        }
        setPnl(data.pnl);
      } catch {
        setError("Network error loading P&L");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    setPnl(initialPnL);
  }, [initialPnL]);

  const budgetBurnAvg = useMemo(() => {
    if (pnl.budgets.length === 0) return null;
    const sum = pnl.budgets.reduce((s, b) => s + b.burn_pct, 0);
    return Math.round((sum / pnl.budgets.length) * 10) / 10;
  }, [pnl.budgets]);

  // Fleet-wide efficiency ratios, matching the sheet's "Cost per Distance" /
  // "Cost per Learner". fleetDistanceKm/totalStudents are always fleet-wide
  // (see the Props comment) -- if a specific campus is selected, pnl.total_expense
  // becomes campus-only, and dividing that by a fleet-wide denominator would be
  // a meaningless number, not just an imprecise one. Only compute these when
  // "All campuses" is selected, so we never show a wrong ratio.
  const costPerKm =
    !schoolId && fleetDistanceKm > 0 ? pnl.total_expense / fleetDistanceKm : null;
  const costPerStudent =
    !schoolId && totalStudents > 0 ? pnl.total_expense / totalStudents : null;

  const overBudget = useMemo(
    () => pnl.budgets.filter((b) => b.burn_pct > 100),
    [pnl.budgets],
  );

  const boardingSeries = boardingTrend.map((d) => d.count);
  const timeInSeries = boardingTrend.map((d) => d.timeIn ?? 0);
  const today = boardingTrend[boardingTrend.length - 1]?.count ?? 0;
  const yesterday = boardingTrend[boardingTrend.length - 2]?.count ?? 0;
  const boardingDelta = pctChange(today, yesterday);

  const expenseValues = Object.values(pnl.expense_by_category);
  const revenueValues = Object.values(pnl.revenue_by_category);

  const expenseSlices = Object.entries(pnl.expense_by_category)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value], i) => ({
      label: shortLabel(label),
      value,
      color: PALETTE[i % PALETTE.length]!,
    }));

  const revenueBars = Object.entries(pnl.revenue_by_category)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value], i) => ({
      label: shortLabel(label),
      value,
      color: PALETTE[(i + 1) % PALETTE.length]!,
    }));

  const pnlPillars = [
    { label: "Rev", value: pnl.total_revenue, color: "#167a37" },
    { label: "Exp", value: pnl.total_expense, color: "#b42318" },
    { label: "Net", value: Math.max(0, pnl.net), color: "#002368" },
  ];

  const maintenanceBudgets = pnl.budgets.filter((b) => b.category === "maintenance");

  const gauges = pnl.budgets.map((b) => ({
    label: b.name.length > 16 ? `${b.name.slice(0, 14)}…` : b.name,
    value: b.burn_pct,
    detail: `${money(pnl.currency, b.spent)} / ${money(pnl.currency, b.budget_amount)}`,
    color:
      b.burn_pct > 90
        ? "var(--danger)"
        : b.burn_pct > 70
          ? "var(--gold)"
          : "var(--light-blue)",
  }));

  const areaPoints = boardingTrend.map((d) => ({
    label: d.date.slice(5),
    primary: d.count,
    secondary: d.timeIn ?? 0,
  }));

  const realtimeRows = [
    {
      label: "Scans today",
      value: today.toLocaleString(),
      tip:
        boardingDelta == null
          ? "—"
          : `${boardingDelta >= 0 ? "+" : ""}${boardingDelta}% vs yesterday`,
    },
    {
      label: "7-day scans",
      value: boardingSeries.reduce((a, b) => a + b, 0).toLocaleString(),
      tip: "Time-in + time-out",
    },
    {
      label: "Time-ins (7d)",
      value: timeInSeries.reduce((a, b) => a + b, 0).toLocaleString(),
      tip: "Boarded students",
    },
    {
      label: "Hire-outs quoted",
      value: money(pnl.currency, pnl.hire_out_quoted),
      tip: `${pnl.hire_outs_in_period} in period`,
    },
  ];

  return (
    <section className="mt-8 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-electric-blue">
            Transport analytics
          </h2>
          <p className="mt-1 text-xs text-ink-faint">
            Live P&amp;L · boarding pulse · budget burn
            {loading ? " · refreshing…" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <DashboardExportButton from={from} to={to} />
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (from && to) void load(from, to, schoolId);
            }}
          >
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-ink-muted">Campus</span>
              <select
                value={schoolId}
                onChange={(e) => setSchoolId(e.target.value)}
                className="rounded-full border border-card-border bg-white/90 px-3 py-1.5 text-sm text-ink"
              >
                <option value="">All campuses</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-ink-muted">From</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-full border border-card-border bg-white/90 px-3 py-1.5 text-sm text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-ink-muted">To</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-full border border-card-border bg-white/90 px-3 py-1.5 text-sm text-ink"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
            >
              Apply
            </button>
          </form>
        </div>
      </div>

      {error ? (
        <p className="text-sm font-semibold text-danger">{error}</p>
      ) : null}

      {/* Sparkline KPI row — Value Analytics style */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SparklineMetricCard
          label="Revenue"
          value={money(pnl.currency, pnl.total_revenue)}
          series={
            revenueValues.length > 1
              ? revenueValues
              : boardingSeries.map((n) => Math.max(n, 1))
          }
          tone="success"
          hint={`${pnl.from} → ${pnl.to}`}
        />
        <SparklineMetricCard
          label="Expense"
          value={money(pnl.currency, pnl.total_expense)}
          series={
            expenseValues.length > 1
              ? expenseValues
              : [...boardingSeries].reverse().map((n) => Math.max(n, 1))
          }
          tone="danger"
          hint="Ledger spend in period"
        />
        <SparklineMetricCard
          label="Boardings"
          value={today.toLocaleString()}
          deltaPct={boardingDelta}
          deltaLabel="vs yesterday"
          series={boardingSeries.length ? boardingSeries : [0]}
          tone="sky"
          hint="Scans today"
        />
        <SparklineMetricCard
          label="Budget burn"
          value={budgetBurnAvg === null ? "—" : `${budgetBurnAvg}%`}
          series={
            pnl.budgets.length > 0
              ? pnl.budgets.map((b) => b.burn_pct)
              : boardingSeries
          }
          tone="gold"
          hint={`${pnl.budgets.length} envelope${pnl.budgets.length === 1 ? "" : "s"}`}
        />
        <SparklineMetricCard
          label="Over budget"
          value={String(overBudget.length)}
          series={pnl.budgets.length > 0 ? pnl.budgets.map((b) => b.burn_pct) : [0]}
          tone={overBudget.length > 0 ? "danger" : "success"}
          hint={overBudget.length > 0 ? "See links below" : "All envelopes within target"}
        />
      </div>

      {overBudget.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-danger/40 bg-danger/10 px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-danger">
            Over budget:
          </span>
          {overBudget.map((b) => (
            <Link
              key={b.id}
              href={`/admin/ledger?tab=budgets#budget-${b.id}`}
              className="rounded-full border border-danger/40 bg-white px-3 py-1 text-xs font-semibold text-danger no-underline hover:bg-danger/10"
            >
              {b.name} · {b.burn_pct}% →
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <article className="ui-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Cost per km
          </p>
          <p className="mt-2 font-display text-2xl font-extrabold text-ink">
            {costPerKm === null ? "—" : money(pnl.currency, costPerKm)}
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            {schoolId
              ? "Fleet-wide only — clear the campus filter to see this"
              : `${fleetDistanceKm.toFixed(0)} km across all active routes (straight-line, not road distance)`}
          </p>
        </article>
        <article className="ui-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Cost per student
          </p>
          <p className="mt-2 font-display text-2xl font-extrabold text-ink">
            {costPerStudent === null ? "—" : money(pnl.currency, costPerStudent)}
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            {schoolId
              ? "Fleet-wide only — clear the campus filter to see this"
              : `${totalStudents.toLocaleString()} riders fleet-wide`}
          </p>
        </article>
      </div>
      <div className="rounded-[var(--radius-sm)] border border-card-border bg-card px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          R&amp;M budget spend
        </p>
        {maintenanceBudgets.length === 0 ? (
          <p className="mt-1.5 text-sm text-ink-muted">
            No maintenance-category budget set for this period yet —{" "}
            <Link
              href="/admin/ledger?tab=budgets"
              className="font-semibold text-electric-blue no-underline hover:underline"
            >
              add one on the Ledger
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {maintenanceBudgets.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/admin/ledger?tab=expenses&category=maintenance&budget=${b.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm no-underline hover:bg-light-blue-30"
                  title="See exactly which expenses make up this spend"
                >
                <span className="font-semibold text-ink">{b.name} →</span>
                <span
                  className={`font-semibold tabular-nums ${
                    b.burn_pct > 100
                      ? "text-danger"
                      : b.burn_pct > 90
                        ? "text-gold"
                        : "text-ink-muted"
                  }`}
                >
                  {money(pnl.currency, b.spent)} / {money(pnl.currency, b.budget_amount)} ·{" "}
                  {b.burn_pct}%
                </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Main analytics grid */}
      <div className="grid gap-4 lg:grid-cols-12">
        <article className="ui-panel p-5 lg:col-span-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-ink">Boarding traffic</h3>
              <p className="mt-0.5 text-xs text-ink-faint">
                Last 7 days · dual smooth area
              </p>
            </div>
          </div>
          <div className="mt-3">
            <SmoothAreaChart
              points={areaPoints}
              primaryLabel="All scans"
              secondaryLabel="Time-in"
            />
          </div>
        </article>

        <article className="ui-panel flex flex-col p-5 lg:col-span-4">
          <h3 className="text-sm font-bold text-ink">Realtime pulse</h3>
          <p className="mt-0.5 text-xs text-ink-faint">Ops snapshot</p>
          <ul className="mt-4 flex flex-1 flex-col justify-between gap-3">
            {realtimeRows.map((row) => (
              <li
                key={row.label}
                className="flex items-start justify-between gap-3 border-b border-card-border/70 pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{row.label}</p>
                  <p className="text-[11px] text-ink-faint">{row.tip}</p>
                </div>
                <p className="font-display text-lg font-extrabold tabular-nums text-electric-blue">
                  {row.value}
                </p>
              </li>
            ))}
          </ul>
        </article>

        <article className="ui-panel p-5 lg:col-span-4">
          <h3 className="text-sm font-bold text-ink">Expense mix</h3>
          <p className="mt-0.5 text-xs text-ink-faint">Category donut</p>
          <div className="mt-4">
            <DonutChart
              slices={expenseSlices}
              centerLabel="Spend"
              centerValue={
                pnl.total_expense > 0
                  ? `${Math.round(pnl.total_expense / 1000)}k`
                  : "0"
              }
              formatValue={(n) => `${Math.round(n / 1000)}k`}
              emptyLabel="No expenses in period"
            />
          </div>
        </article>

        <article className="ui-panel p-5 lg:col-span-4">
          <h3 className="text-sm font-bold text-ink">P&amp;L pillars</h3>
          <p className="mt-0.5 text-xs text-ink-faint">Rounded bar compare</p>
          <div className="mt-4">
            <PillBarChart
              bars={pnlPillars}
              formatValue={(n) => `${Math.round(n / 1000)}k`}
              highlightIndex={2}
            />
          </div>
        </article>

        <article className="ui-panel p-5 lg:col-span-4">
          <h3 className="text-sm font-bold text-ink">Budget gauges</h3>
          <p className="mt-0.5 text-xs text-ink-faint">Burn vs envelope</p>
          <div className="mt-3">
            <GaugeChart gauges={gauges} />
          </div>
        </article>
      </div>

      {revenueBars.length > 0 ? (
        <article className="ui-panel p-5">
          <h3 className="text-sm font-bold text-ink">Revenue by category</h3>
          <p className="mt-0.5 text-xs text-ink-faint">Horizontal rank bars</p>
          <div className="mt-4 max-w-3xl">
            <HorizontalBarChart
              bars={revenueBars}
              formatValue={(n) => `${Math.round(n / 1000)}k`}
            />
          </div>
        </article>
      ) : null}
    </section>
  );
}
