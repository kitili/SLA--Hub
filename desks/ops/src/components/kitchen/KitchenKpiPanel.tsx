import type { KitchenKpi } from "@/lib/kitchen/kitchen-kpis";

type Props = {
  kpis: KitchenKpi[];
  error?: string;
};

export function KitchenKpiPanel({ kpis, error }: Props) {
  return (
    <section className="ui-rise mb-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
            Kitchens Top Sheet · live
          </p>
          <h2 className="mt-0.5 font-display text-xl font-bold text-ink">
            Target vs actual
          </h2>
          <p className="mt-1 max-w-xl text-sm text-ink-muted">
            Replaces the workbook Top Sheet formulas (wrong tab / frozen January / budget vs
            itself) with live checklist and budget numbers.
          </p>
        </div>
        <p className="text-xs text-ink-faint">Computed from Ops tables · not a sheet import</p>
      </div>

      {error ? (
        <p className="rounded-[var(--radius-sm)] border border-danger/40 bg-danger-15 px-4 py-3 text-sm font-semibold text-danger">
          Couldn&apos;t load live KPIs: {error}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {kpis.map((kpi, i) => {
            const empty = kpi.actualDisplay === "—";
            const tone = empty
              ? "border-card-border"
              : kpi.good
                ? "border-success/30"
                : "border-danger/30";
            const valueTone = empty
              ? "text-ink-faint"
              : kpi.good
                ? "text-success"
                : "text-danger";
            return (
              <div
                key={kpi.label}
                className={`ui-rise rounded-[var(--radius)] border bg-card p-5 shadow-[var(--shadow)] ${tone}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {kpi.label}
                </p>
                <p className={`mt-2 font-display text-3xl font-extrabold tabular-nums ${valueTone}`}>
                  {kpi.actualDisplay}
                </p>
                <p className="mt-1 text-xs text-ink-faint">Target {kpi.targetDisplay}</p>
                {empty ? (
                  <p className="mt-2 inline-block rounded-full bg-gold-15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                    No data yet
                  </p>
                ) : (
                  <p
                    className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      kpi.good ? "bg-success-15 text-success" : "bg-danger-15 text-danger"
                    }`}
                  >
                    {kpi.good ? "On target" : "Off target"}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
