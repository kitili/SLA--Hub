import type { CeoKpi } from "@/lib/dashboard/transport-ceo-kpis";

type Props = {
  kpis: CeoKpi[];
  error?: string;
};

export function CeoKpiPanel({ kpis, error }: Props) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
            Transport leadership
          </p>
          <h2 className="mt-0.5 font-display text-xl font-bold text-ink">
            Target vs. actual
          </h2>
        </div>
        <p className="text-xs text-ink-faint">Occupancy is live from the fleet · others from Transport Summary sheet</p>
      </div>

      {error ? (
        <p className="mb-4 rounded-[var(--radius-sm)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
      {kpis.length === 0 ? null : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className={`ui-panel p-5 ${
                kpi.good ? "border-success/30" : "border-danger/30"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {kpi.label}
              </p>
              <p
                className={`mt-2 font-display text-3xl font-extrabold tabular-nums ${
                  kpi.good ? "text-success" : "text-danger"
                }`}
              >
                {kpi.actualDisplay}
              </p>
              <p className="mt-1 text-xs text-ink-faint">
                Target {kpi.targetDisplay}
              </p>
              <p
                className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  kpi.good ? "bg-success-15 text-success" : "bg-danger-15 text-danger"
                }`}
              >
                {kpi.good ? "On target" : "Off target"}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
