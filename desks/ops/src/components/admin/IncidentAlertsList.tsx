"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useConfirm } from "./ConfirmDialog";

type Alert = {
  id: string;
  incident_id: string;
  trip_id: string | null;
  severity: string;
  type: string;
  message: string;
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  breakdown: "Breakdown",
  accident: "Accident",
  delay: "Delay",
  medical: "Medical",
  behavior: "Behavior",
  other: "Other",
  overload: "Bus overloaded",
  incomplete_roster: "Roster incomplete",
  unlisted_child: "Unlisted child",
};

export function IncidentAlertsList({
  canAcknowledge,
}: {
  canAcknowledge: boolean;
}) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<string | null>(null);
  const [acking, setAcking] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const [escalating, setEscalating] = useState<string | null>(null);

  const unacked = useMemo(
    () => alerts.filter((a) => !a.acknowledged_at).length,
    [alerts],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSetup(null);
    try {
      const res = await fetch("/api/incident-alerts");
      const data = (await res.json()) as {
        alerts?: Alert[];
        error?: string;
        hint?: string;
        setup?: string;
      };
      if (!res.ok) {
        setAlerts([]);
        setError([data.error ?? `Failed to load (${res.status})`, data.hint].filter(Boolean).join(" "));
        setSetup(data.setup ?? null);
        return;
      }
      setAlerts(data.alerts ?? []);
    } catch {
      setAlerts([]);
      setError("Network error loading alerts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function acknowledge(alert: Alert) {
    const ok = await confirm({
      title: "Acknowledge alert?",
      message: `Mark this ${alert.severity.toLowerCase()} ${alert.type} alert ("${alert.message}") as acknowledged?`,
      confirmLabel: "Acknowledge",
    });
    if (!ok) return;
    setAcking(alert.id);
    try {
      const res = await fetch("/api/incident-alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId: alert.id }),
      });
      if (res.ok) await load();
    } finally {
      setAcking(null);
    }
  }

  async function escalateToCommandCenter(alertId: string) {
    setEscalating(alertId);
    try {
      const res = await fetch("/api/incident-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId }),
      });
      if (res.ok) await load();
    } finally {
      setEscalating(null);
    }
  }

  return (
    <>
      <div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-sm leading-relaxed text-ink-muted">
              Raised automatically when a matron or driver reports a{" "}
              <strong className="text-ink">high-severity</strong> incident, an{" "}
              <strong className="text-ink">accident</strong>, or a{" "}
              <strong className="text-ink">breakdown</strong> — or when you escalate
              from the Incidents list. Unacknowledged items appear on the{" "}
              <Link href="/ops/admin" className="font-semibold text-electric-blue">
                command center
              </Link>{" "}
              for super-admin action.
            </p>
            {unacked > 0 ? (
              <p className="mt-2 text-sm font-semibold text-danger">
                {unacked} unacknowledged escalation{unacked === 1 ? "" : "s"} on
                command center
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="shrink-0 rounded-xl bg-electric-blue px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-navy-light"
          >
            Refresh
          </button>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-danger/30 bg-gradient-to-br from-danger-15 to-white px-5 py-4">
            <p className="font-display font-bold text-danger">Setup required</p>
            <p className="mt-1 text-sm text-ink">{error}</p>
            {setup === "schema_directors.sql" || /incident_alerts/i.test(error) ? (
              <div className="mt-4 rounded-xl border border-card-border bg-white p-4 text-sm">
                <p className="font-semibold text-ink">Run once in Supabase SQL Editor:</p>
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-ink-muted">
                  <li>
                    Open Supabase → <strong className="text-ink">SQL Editor</strong> → New query
                  </li>
                  <li>
                    <strong className="text-ink">Run 1:</strong> paste{" "}
                    <code className="rounded bg-light-blue-30 px-1.5 py-0.5 text-xs">
                      supabase/APPLY_INCIDENT_ALERTS_01_enum.sql
                    </code>{" "}
                    → Run (adds <code className="text-xs">director</code> role)
                  </li>
                  <li>
                    <strong className="text-ink">Run 2:</strong> paste{" "}
                    <code className="rounded bg-light-blue-30 px-1.5 py-0.5 text-xs">
                      supabase/APPLY_INCIDENT_ALERTS.sql
                    </code>{" "}
                    → Run (table + policies)
                  </li>
                  <li>
                    Refresh this page
                  </li>
                </ol>
              </div>
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <p className="mt-8 text-sm text-ink-muted">Loading escalations…</p>
        ) : alerts.length === 0 && !error ? (
          <div className="mt-8 rounded-2xl border border-dashed border-success/30 bg-success-15/50 p-10 text-center">
            <p className="font-display text-lg font-bold text-success">All clear</p>
            <p className="mt-2 text-sm text-ink-muted">No incident escalations on the feed.</p>
          </div>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {alerts.map((alert) => {
              const acked = Boolean(alert.acknowledged_at);
              const busy = escalating === alert.id;
              return (
                <li
                  key={alert.id}
                  className={`overflow-hidden rounded-2xl border bg-white shadow-[var(--shadow)] ${
                    acked ? "border-card-border opacity-80" : "border-danger/25"
                  }`}
                >
                  <div
                    className={`h-1 ${acked ? "bg-success/40" : "bg-danger"}`}
                    aria-hidden
                  />
                  <div className="flex items-stretch gap-3 p-4 sm:p-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                              acked
                                ? "bg-ink-faint/15 text-ink-muted"
                                : "bg-danger-15 text-danger"
                            }`}
                          >
                            {alert.severity}
                          </span>
                          <span className="text-sm font-semibold text-ink">
                            {TYPE_LABELS[alert.type] ?? alert.type}
                          </span>
                          {!acked ? (
                            <Link
                              href="/ops/admin"
                              className="rounded-full bg-gold-15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-electric-blue no-underline"
                            >
                              On command center
                            </Link>
                          ) : null}
                        </div>
                        {acked ? (
                          <span className="rounded-full bg-success-15 px-2.5 py-0.5 text-xs font-bold text-success">
                            Acknowledged
                          </span>
                        ) : canAcknowledge ? (
                          <button
                            type="button"
                            disabled={acking === alert.id}
                            onClick={() => void acknowledge(alert)}
                            className="rounded-xl border border-electric-blue/30 bg-light-blue-30 px-3 py-1.5 text-xs font-bold text-electric-blue hover:bg-white disabled:opacity-50"
                          >
                            {acking === alert.id ? "…" : "Acknowledge"}
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-ink">{alert.message}</p>
                      <p className="mt-2 text-xs text-ink-faint">
                        {new Date(alert.created_at).toLocaleString()}
                        {alert.trip_id ? ` · Trip ${alert.trip_id.slice(0, 8)}…` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-center justify-center gap-1 border-l border-card-border/70 pl-3">
                      <button
                        type="button"
                        disabled={busy || !acked}
                        title={
                          acked
                            ? "Re-escalate to command center"
                            : "Already on command center"
                        }
                        aria-label={
                          acked
                            ? "Re-escalate to command center"
                            : "Already on command center"
                        }
                        onClick={() => void escalateToCommandCenter(alert.id)}
                        className={`relative flex h-9 w-9 items-center justify-center rounded-full transition disabled:cursor-default ${
                          acked ? "hover:bg-danger-15" : "bg-danger/10"
                        }`}
                      >
                        <span
                          className={`block h-3.5 w-3.5 rounded-full ${
                            acked
                              ? "border-2 border-danger/50 bg-transparent"
                              : "bg-danger shadow-[0_0_0_3px_rgba(220,38,38,0.25)]"
                          } ${busy ? "animate-pulse" : ""}`}
                        />
                      </button>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                        {acked ? "Escalate" : "Live"}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {dialog}
    </>
  );
}
