import Link from "next/link";
import type { FacilitiesTopSheet as TopSheet } from "@/lib/db/facilities";
import { FacilitiesDataBanner } from "@/components/facilities/FacilitiesDataBanner";

type Props = {
  sheet: TopSheet;
  monthOptions: string[];
};

function Metric({
  label,
  value,
  hint,
  good,
}: {
  label: string;
  value: string;
  hint?: string;
  good?: boolean | null;
}) {
  return (
    <div
      className={`rounded-[var(--radius)] border bg-card p-4 shadow-[var(--shadow)] ${
        good === true
          ? "border-success/30"
          : good === false
            ? "border-danger/30"
            : "border-card-border"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-extrabold tabular-nums text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-faint">{hint}</p> : null}
    </div>
  );
}

function fmt(n: number | null, digits = 1) {
  if (n === null) return "—";
  return n.toFixed(digits);
}

export function FacilitiesTopSheet({ sheet, monthOptions }: Props) {
  const totalLoaded =
    sheet.counts.issues +
    sheet.counts.checklist +
    sheet.counts.generator +
    sheet.counts.houses +
    sheet.counts.power +
    sheet.counts.cctv +
    sheet.counts.classrooms +
    sheet.counts.sops;

  return (
    <section className="ui-rise mb-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
            Facilities Top Sheet · {sheet.campus}
          </p>
          <h2 className="mt-0.5 font-display text-xl font-bold text-ink">
            Month of {sheet.monthLabel}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Lead: {sheet.lead} · Live checklist, generator, and R&amp;M — same A/B/C structure as
            the Usa River master workbook (not a frozen CSV export).
          </p>
        </div>
        <form method="get" className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Month
            <select
              name="month"
              defaultValue={sheet.monthKey}
              className="ml-2 rounded-[var(--radius-sm)] border border-card-border px-3 py-1.5 text-sm text-ink"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-[var(--radius-sm)] border border-card-border bg-card px-3 py-1.5 text-sm font-semibold text-electric-blue hover:bg-light-blue-30"
          >
            Apply
          </button>
        </form>
      </div>

      <FacilitiesDataBanner
        error={sheet.error}
        empty={!sheet.error && totalLoaded === 0}
        emptyHint="Nothing logged for this month yet — once checklist, generator, or R&M entries exist, they'll summarize here."
      />

      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <div className="ui-rise rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)] sm:col-span-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
            A · Facilities Checklist Completion Rate
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Metric
              label="Walkthroughs this month"
              value={`${sheet.checklistWalkthroughsDone} / ${sheet.checklistWalkthroughsTarget}`}
              hint="Target: 4 weekly walkthroughs"
              good={
                sheet.checklistWalkthroughsDone === 0
                  ? null
                  : sheet.checklistWalkthroughsDone >= sheet.checklistWalkthroughsTarget
              }
            />
            <Metric
              label="Average score (1–5)"
              value={fmt(sheet.checklistAvgScore)}
              hint={
                sheet.checklistAvgRatio === null
                  ? "No scores in this month"
                  : `Sheet ratio ${fmt(sheet.checklistAvgRatio, 3)} of 1.0 · YTD ${fmt(sheet.ytdChecklistAvg)}`
              }
              good={
                sheet.checklistAvgScore === null ? null : sheet.checklistAvgScore >= 4.5
              }
            />
            <Metric
              label="Checklist score rows (all time)"
              value={String(sheet.counts.checklist)}
              hint={`${sheet.from} → ${sheet.to} in view`}
            />
          </div>
        </div>

        <div className="ui-rise rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)] sm:col-span-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
            B · Generator Checklist Performance
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Metric
              label="Days checked this month"
              value={String(sheet.generatorDaysChecked)}
              hint="Unique log dates with scores"
            />
            <Metric
              label="Average score MTD"
              value={fmt(sheet.generatorAvgScore)}
              hint={`Target 4.5/5 · YTD ${fmt(sheet.ytdGeneratorAvg)}`}
              good={
                sheet.generatorAvgScore === null ? null : sheet.generatorAvgScore >= 4.5
              }
            />
            <Metric
              label="Generator log rows (all time)"
              value={String(sheet.counts.generator)}
            />
          </div>
        </div>

        <div className="ui-rise rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)] sm:col-span-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
            C · Repairs and Maintenance
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Outstanding tickets"
              value={String(sheet.outstandingTickets)}
              hint={`${sheet.totalIssues} total · ${sheet.closedTickets} closed this month`}
              good={
                sheet.totalIssues === 0 ? null : sheet.outstandingTickets <= 2
              }
            />
            <Metric
              label="Avg age of outstanding"
              value={sheet.avgOutstandingAgeDays === null ? "—" : `${fmt(sheet.avgOutstandingAgeDays)} d`}
            />
            <Metric
              label="Avg time to close"
              value={sheet.avgCloseDays === null ? "—" : `${fmt(sheet.avgCloseDays)} d`}
              hint="Target ≤ 14 days"
              good={sheet.avgCloseDays === null ? null : sheet.avgCloseDays <= 14}
            />
            <Metric label="R&M tickets (all time)" value={String(sheet.counts.issues)} />
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["Houses", sheet.counts.houses, "/ops/facilities/houses"],
            ["Power readings", sheet.counts.power, "/ops/facilities/power"],
            ["CCTV cameras", sheet.counts.cctv, "/ops/facilities/cctv"],
            ["Classroom items", sheet.counts.classrooms, "/ops/facilities/classrooms"],
            ["SOPs", sheet.counts.sops, "/ops/facilities/sops"],
            ["Checklist scores", sheet.counts.checklist, "/ops/facilities/checklist"],
            ["Generator scores", sheet.counts.generator, "/ops/facilities/generator"],
            ["R&M issues", sheet.counts.issues, "/ops/facilities/issues"],
          ] as const
        ).map(([label, count, href]) => (
          <Link
            key={href}
            href={href}
            className="flex items-center justify-between rounded-[var(--radius-sm)] border border-card-border bg-card px-3 py-2 text-sm no-underline hover:bg-light-blue-30"
          >
            <span className="font-semibold text-ink">{label}</span>
            <span className="tabular-nums font-bold text-electric-blue">{count}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
