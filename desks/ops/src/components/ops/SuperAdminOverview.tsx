import Link from "next/link";
import { CeoKpiPanel } from "@/components/admin/CeoKpiPanel";
import type { CeoKpi } from "@/lib/dashboard/transport-ceo-kpis";
import type {
  DomainOverview,
  OverviewAlert,
  SuperAdminOverview,
} from "@/lib/dashboard/super-admin-overview";

function StatusBadge({ status }: { status: DomainOverview["status"] }) {
  if (status === "critical") {
    return (
      <span className="rounded-full bg-danger px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm shadow-danger/30">
        Critical
      </span>
    );
  }
  if (status === "warning") {
    return (
      <span className="rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink shadow-sm">
        Attention
      </span>
    );
  }
  return (
    <span className="rounded-full bg-success-15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
      Healthy
    </span>
  );
}

function AlertRow({ alert }: { alert: OverviewAlert }) {
  const critical = alert.severity === "critical";
  return (
    <li
      className={`rounded-[var(--radius)] border p-4 ${
        critical
          ? "border-danger bg-danger-15 ring-1 ring-danger/20"
          : "border-gold/40 bg-gold-15"
      }`}
      style={critical ? { borderLeftWidth: 4, borderLeftColor: "var(--danger)" } : undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className={`text-sm font-bold ${critical ? "text-danger" : "text-ink"}`}
          >
            {critical ? "⚠ " : ""}
            {alert.title}
          </p>
          <p className="mt-1 text-sm text-ink-muted">{alert.detail}</p>
        </div>
        <Link
          href={alert.href}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold no-underline ${
            critical
              ? "bg-danger text-white hover:bg-danger/90"
              : "border border-card-border bg-white text-electric-blue hover:bg-light-blue-30"
          }`}
        >
          Open
        </Link>
      </div>
    </li>
  );
}

function DomainCard({ domain }: { domain: DomainOverview }) {
  const critical = domain.status === "critical";
  const warning = domain.status === "warning";

  return (
    <article
      className={`ui-panel flex flex-col p-5 transition ${
        critical
          ? "border-danger/40 ring-1 ring-danger/20"
          : warning
            ? "border-gold/40"
            : "border-card-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-light-blue">
            {domain.name}
          </p>
          <p className="mt-1 text-sm text-ink-muted">{domain.summary}</p>
        </div>
        <StatusBadge status={domain.status} />
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {domain.metrics.map((m) => (
          <div key={m.label} className="rounded-[var(--radius-sm)] bg-light-blue-30/60 px-3 py-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
              {m.label}
            </dt>
            <dd
              className={`mt-0.5 font-display text-lg font-bold tabular-nums ${
                m.good === true
                  ? "text-success"
                  : m.good === false
                    ? "text-danger"
                    : "text-ink"
              }`}
            >
              {m.value}
            </dd>
          </div>
        ))}
      </dl>

      <Link
        href={domain.href}
        className="mt-4 inline-flex text-sm font-semibold text-electric-blue no-underline hover:underline"
      >
        Open {domain.name} dashboard →
      </Link>
    </article>
  );
}

export function SuperAdminOverviewPanel({
  data,
  ceoKpis,
  ceoError,
}: {
  data: SuperAdminOverview;
  ceoKpis?: CeoKpi[];
  ceoError?: string;
}) {
  const hasCritical = data.counts.critical > 0;
  const showCeo = (ceoKpis && ceoKpis.length > 0) || Boolean(ceoError);

  return (
    <div className="space-y-8">
      {showCeo ? (
        <CeoKpiPanel kpis={ceoKpis ?? []} error={ceoError} />
      ) : null}

      <section
        className={`rounded-[var(--radius)] border px-5 py-4 ${
          hasCritical
            ? "border-danger/50 bg-gradient-to-r from-danger-15 via-white to-danger-15"
            : data.counts.warning > 0
              ? "border-gold/40 bg-gold-15/40"
              : "border-success/30 bg-success-15/30"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
              {data.scopeLabel} · {data.monthLabel}
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink">
              {hasCritical
                ? `${data.counts.critical} critical issue${data.counts.critical === 1 ? "" : "s"} need action now`
                : data.counts.warning > 0
                  ? `${data.counts.warning} item${data.counts.warning === 1 ? "" : "s"} need attention`
                  : data.domains.length > 0
                    ? "Your departments are within targets"
                    : "No department KPIs in scope"}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-danger-15 px-3 py-1 text-xs font-bold text-danger">
              {data.counts.critical} critical
            </span>
            <span className="rounded-full bg-gold-15 px-3 py-1 text-xs font-bold text-ink">
              {data.counts.warning} attention
            </span>
            <span className="rounded-full bg-success-15 px-3 py-1 text-xs font-bold text-success">
              {data.counts.healthy} healthy
            </span>
          </div>
        </div>
      </section>

      {data.alerts.length > 0 ? (
        <section>
          <h3 className="mb-3 font-display text-lg font-bold text-ink">
            {hasCritical ? "Needs immediate action" : "Watch list"}
          </h3>
          <ul className="flex flex-col gap-3">
            {data.alerts.map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h3 className="mb-3 font-display text-lg font-bold text-ink">
          Department dashboards
        </h3>
        <div className="grid gap-4 lg:grid-cols-2">
          {data.domains.map((domain) => (
            <DomainCard key={domain.id} domain={domain} />
          ))}
        </div>
      </section>

      <p className="text-xs text-ink-faint">
        Budget critical threshold: {Math.round(0.2 * 100)}% over plan. Refreshed{" "}
        {new Date(data.generatedAt).toLocaleString()}.
      </p>
    </div>
  );
}
