"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { School } from "@/types/database";
import { countBySchool } from "@/lib/dashboard/campus-count";
import { CampusCountChips } from "@/components/admin/CampusCountChips";

type Incident = {
  id: string;
  trip_id: string;
  reported_by: string | null;
  type: string;
  severity: string;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  school_id: string | null;
};

const SEVERITIES = ["", "low", "medium", "high"] as const;

const SEVERITY_STYLES: Record<string, string> = {
  low: "bg-success-15 text-success",
  medium: "bg-gold-15 text-electric-blue",
  high: "bg-danger-15 text-danger",
};

const TYPE_LABELS: Record<string, string> = {
  breakdown: "Breakdown",
  accident: "Accident",
  delay: "Delay",
  medical: "Medical",
  behavior: "Behavior",
  other: "Other",
};

export function IncidentsAdminList({ schools }: { schools: School[] }) {
  const [severity, setSeverity] = useState("");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [escalatedIds, setEscalatedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [escalating, setEscalating] = useState<string | null>(null);

  const loadEscalations = useCallback(async () => {
    try {
      const res = await fetch("/api/incident-alerts?limit=200");
      const data = (await res.json()) as {
        alerts?: { incident_id: string; acknowledged_at: string | null }[];
      };
      if (!res.ok) return;
      const ids = new Set(
        (data.alerts ?? [])
          .filter((a) => !a.acknowledged_at)
          .map((a) => a.incident_id),
      );
      setEscalatedIds(ids);
    } catch {
      // ignore — escalate buttons still work
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = severity ? `?severity=${encodeURIComponent(severity)}` : "";
      const res = await fetch(`/api/incidents${qs}`);
      const data = (await res.json()) as {
        incidents?: Incident[];
        error?: string;
        hint?: string;
        setup?: string;
      };
      if (!res.ok) {
        setIncidents([]);
        const parts = [
          data.error ?? `Failed to load (${res.status})`,
          data.hint,
        ].filter(Boolean);
        setError(parts.join(" "));
        return;
      }
      setIncidents(data.incidents ?? []);
      await loadEscalations();
    } catch {
      setIncidents([]);
      setError("Network error loading incidents");
    } finally {
      setLoading(false);
    }
  }, [severity, loadEscalations]);

  useEffect(() => {
    void load();
  }, [load]);

  async function escalate(incidentId: string) {
    setEscalating(incidentId);
    try {
      const res = await fetch("/api/incident-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId }),
      });
      if (res.ok) {
        setEscalatedIds((prev) => new Set(prev).add(incidentId));
      }
    } finally {
      setEscalating(null);
    }
  }

  const campusCounts = useMemo(
    () => countBySchool(incidents, (i) => i.school_id, schools),
    [incidents, schools],
  );
  const visible = selectedSchoolId
    ? incidents.filter((i) => i.school_id === selectedSchoolId)
    : incidents;

  return (
    <div className="mt-6">
      <CampusCountChips
        counts={campusCounts}
        selected={selectedSchoolId}
        onSelect={setSelectedSchoolId}
      />
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Severity</span>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
          >
            {SEVERITIES.map((value) => (
              <option key={value || "all"} value={value}>
                {value ? value.charAt(0).toUpperCase() + value.slice(1) : "All"}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
        >
          Refresh
        </button>
        <p className="ml-auto max-w-xs text-xs text-ink-muted">
          Tap the dot on a row to escalate it to the{" "}
          <Link href="/ops/admin" className="font-semibold text-electric-blue">
            command center
          </Link>
          .
        </p>
      </div>

      {error ? (
        <div className="mt-4 rounded-[var(--radius)] border border-danger/30 bg-danger-15 px-4 py-3 text-sm text-danger">
          <p className="font-semibold">{error}</p>
          {/incidents/i.test(error) ? (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink">
              <li>
                Open Supabase → <strong>SQL Editor</strong> → New query
              </li>
              <li>
                Paste contents of{" "}
                <code className="text-xs">supabase/schema_incidents.sql</code>
              </li>
              <li>
                Click <strong>Run</strong>, then hit Refresh above
              </li>
            </ol>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-ink-muted">Loading incidents…</p>
      ) : visible.length === 0 ? (
        <div className="mt-6 rounded-[var(--radius)] border border-dashed border-card-border bg-light-blue-30 p-8 text-center text-sm text-ink-muted">
          No incidents{severity ? ` with severity “${severity}”` : ""}.
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {visible.map((incident) => {
            const onCommandCenter = escalatedIds.has(incident.id);
            const busy = escalating === incident.id;
            return (
              <li
                key={incident.id}
                className="overflow-hidden rounded-2xl border border-card-border bg-white shadow-[var(--shadow)]"
              >
                <div
                  className={`h-1 ${
                    incident.severity === "high"
                      ? "bg-danger"
                      : incident.severity === "medium"
                        ? "bg-gold"
                        : "bg-success/50"
                  }`}
                  aria-hidden
                />
                <div className="flex items-stretch gap-3 p-4 sm:p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${
                          SEVERITY_STYLES[incident.severity] ?? "bg-gray text-ink"
                        }`}
                      >
                        {incident.severity}
                      </span>
                      <span className="text-xs font-semibold text-ink-muted">
                        {TYPE_LABELS[incident.type] ?? incident.type}
                      </span>
                      <span className="text-xs text-ink-faint">
                        · trip {incident.trip_id.slice(0, 8)}…
                      </span>
                      {onCommandCenter ? (
                        <Link
                          href="/ops/admin"
                          className="rounded-full bg-gold-15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-electric-blue no-underline"
                        >
                          On command center
                        </Link>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-ink">
                      {incident.notes || "No notes"}
                    </p>
                    <p className="mt-1 text-xs text-ink-faint">
                      {new Date(incident.created_at).toLocaleString()}
                      {incident.lat != null && incident.lng != null
                        ? ` · ${incident.lat.toFixed(4)}, ${incident.lng.toFixed(4)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-center justify-center gap-1 border-l border-card-border/70 pl-3">
                    <button
                      type="button"
                      disabled={busy || onCommandCenter}
                      title={
                        onCommandCenter
                          ? "Already on command center"
                          : "Escalate to command center"
                      }
                      aria-label={
                        onCommandCenter
                          ? "Already escalated to command center"
                          : "Escalate to command center"
                      }
                      onClick={() => void escalate(incident.id)}
                      className={`relative flex h-9 w-9 items-center justify-center rounded-full transition disabled:cursor-default ${
                        onCommandCenter
                          ? "bg-danger/10"
                          : "hover:bg-danger-15"
                      }`}
                    >
                      <span
                        className={`block h-3.5 w-3.5 rounded-full ${
                          onCommandCenter
                            ? "bg-danger shadow-[0_0_0_3px_rgba(220,38,38,0.25)]"
                            : "border-2 border-danger/50 bg-transparent"
                        } ${busy ? "animate-pulse" : ""}`}
                      />
                    </button>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                      {onCommandCenter ? "Live" : "Escalate"}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
