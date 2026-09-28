import type { KitchenCampusSummary } from "@/lib/kitchen/kitchen-kpis";
import { CHECKLIST_TARGET_PCT } from "@/lib/kitchen/checklist-score";

function formatTzs(n: number) {
  return `TZS ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function pctCell(pct: number | null) {
  if (pct === null) {
    return <span className="text-ink-faint">—</span>;
  }
  const pctValue = Math.round(pct * 100);
  return (
    <span className={pct >= CHECKLIST_TARGET_PCT ? "font-semibold text-success" : "font-semibold text-danger"}>
      {pctValue}%
    </span>
  );
}

export function KitchenCampusSummaryGrid({ summaries }: { summaries: KitchenCampusSummary[] }) {
  const monthLabel = summaries[0]
    ? new Date(summaries[0].month).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : "";

  return (
    <section className="ui-rise mt-6 rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
        All {summaries.length} campuses
      </p>
      <h2 className="mt-1 font-display text-lg font-bold text-ink">Campus summary</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Procurement figures are for {monthLabel || "the campus's most recent recorded month"}.
        Checklist scores are for the current week/month.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-ink-muted">
              <th className="pb-2">Campus</th>
              <th className="pb-2">Person-days</th>
              <th className="pb-2">Purchases logged</th>
              <th className="pb-2">Cost/person-day</th>
              <th className="pb-2">Budget</th>
              <th className="pb-2">Daily checklist</th>
              <th className="pb-2">Weekly/Monthly</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border">
            {summaries.map((s) => (
              <tr key={s.schoolId}>
                <td className="py-2 font-semibold text-ink">{s.schoolName}</td>
                <td className="py-2">
                  {s.personDays !== null ? (
                    s.personDays.toLocaleString()
                  ) : (
                    <span className="text-ink-faint">No headcount logged yet</span>
                  )}
                </td>
                <td className="py-2">
                  {s.purchasesTotal !== null ? (
                    `${formatTzs(s.purchasesTotal)} (${s.purchasesCount})`
                  ) : (
                    <span className="text-ink-faint">No purchases logged yet</span>
                  )}
                </td>
                <td className="py-2">
                  {s.costPerPersonDay !== null ? (
                    <span className="font-semibold text-electric-blue">
                      TZS {s.costPerPersonDay.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </td>
                <td className="py-2">
                  {s.budgetAmount !== null ? (
                    formatTzs(s.budgetAmount)
                  ) : (
                    <span className="text-ink-faint">Not set yet</span>
                  )}
                </td>
                <td className="py-2">{pctCell(s.dailyPct)}</td>
                <td className="py-2">{pctCell(s.weeklyMonthlyPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-ink-faint">
          — = no data logged yet, not a zero. Target for both checklist columns is{" "}
          {Math.round(CHECKLIST_TARGET_PCT * 100)}%.
        </p>
      </div>
    </section>
  );
}
