import type { FacilitiesKpi } from "@/lib/db/facilities";

type Props = {
  kpis: FacilitiesKpi[];
};

export function FacilitiesKpiPanel({ kpis }: Props) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
            Facilities
          </p>
          <h2 className="mt-0.5 font-display text-xl font-bold text-ink">
            Last 90 days — target vs. actual
          </h2>
        </div>
        <p className="text-xs text-ink-faint">Computed from live data</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className={`ui-panel p-5 ${
              kpi.good === null
                ? "border-card-border"
                : kpi.good
                  ? "border-success/30"
                  : "border-danger/30"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {kpi.label}
            </p>
            <p
              className={`mt-2 font-display text-3xl font-extrabold tabular-nums ${
                kpi.good === null
                  ? "text-ink-faint"
                  : kpi.good
                    ? "text-success"
                    : "text-danger"
              }`}
            >
              {kpi.actual === null ? "—" : `${kpi.actual}${kpi.unit}`}
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              Target {kpi.target}
              {kpi.unit}
            </p>
            {kpi.good !== null ? (
              <p
                className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  kpi.good ? "bg-success-15 text-success" : "bg-danger-15 text-danger"
                }`}
              >
                {kpi.good ? "On target" : "Off target"}
              </p>
            ) : (
              <p className="mt-2 inline-block rounded-full bg-gold-15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                No data yet
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
