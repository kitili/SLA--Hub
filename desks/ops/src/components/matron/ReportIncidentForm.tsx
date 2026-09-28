"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadActiveTrip } from "@/lib/matron/active-trip";
import type { IncidentType } from "@/types/database";

export type IncidentTripOption = {
  id: string;
  label: string;
  status: string;
};

export const TYPES: {
  value: IncidentType;
  label: string;
  hint: string;
}[] = [
  { value: "delay", label: "Delay", hint: "Traffic or late leave" },
  { value: "breakdown", label: "Breakdown", hint: "Bus won’t move" },
  { value: "accident", label: "Accident", hint: "Collision / near miss" },
  { value: "medical", label: "Medical", hint: "Student needs care" },
  { value: "behavior", label: "Behavior", hint: "Safety on board" },
  { value: "other", label: "Other", hint: "Anything else" },
];

const SEVERITIES: {
  value: "low" | "medium" | "high";
  label: string;
  hint: string;
}[] = [
  { value: "low", label: "Low", hint: "Note only" },
  { value: "medium", label: "Medium", hint: "Ops should know" },
  { value: "high", label: "High", hint: "Alert admin now" },
];

type Props = {
  activeTrips: IncidentTripOption[];
  recentTrips: IncidentTripOption[];
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function nowLocalInput() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ReportIncidentForm({ activeTrips, recentTrips }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"active" | "late">(
    activeTrips.length > 0 ? "active" : "late",
  );
  const [tripId, setTripId] = useState(activeTrips[0]?.id ?? recentTrips[0]?.id ?? "");
  const [type, setType] = useState<IncidentType>("delay");
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium");
  const [notes, setNotes] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneAt, setDoneAt] = useState<string | null>(null);

  useEffect(() => {
    setOccurredAt(nowLocalInput());
  }, []);

  useEffect(() => {
    const active = loadActiveTrip();
    if (active?.tripId && activeTrips.some((t) => t.id === active.tripId)) {
      setMode("active");
      setTripId(active.tripId);
    }
  }, [activeTrips]);

  const tripOptions = useMemo(
    () => (mode === "active" ? activeTrips : recentTrips),
    [mode, activeTrips, recentTrips],
  );

  useEffect(() => {
    if (!tripOptions.some((t) => t.id === tripId)) {
      setTripId(tripOptions[0]?.id ?? "");
    }
  }, [tripOptions, tripId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!tripId) {
      setError(
        mode === "active"
          ? "Start an active trip on Home first."
          : "Pick a trip for the late log.",
      );
      return;
    }
    if (mode === "late" && !occurredAt) {
      setError("Pick the day and time the incident happened.");
      return;
    }
    if (mode === "late" && !notes.trim()) {
      setError("Add a short description for the late log.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let lat: number | null = null;
      let lng: number | null = null;
      if (mode === "active" && "geolocation" in navigator) {
        const pos = await new Promise<GeolocationPosition | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (p) => resolve(p),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 6000, maximumAge: 15_000 },
          );
        });
        if (pos) {
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
      }

      const occurredIso =
        mode === "late" && occurredAt
          ? new Date(occurredAt).toISOString()
          : null;

      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          type,
          severity,
          notes,
          lat,
          lng,
          occurredAt: occurredIso,
          late: mode === "late",
        }),
      });
      const data = (await res.json()) as {
        incident?: { created_at: string };
        error?: string;
      };
      if (!res.ok || !data.incident) {
        setError(data.error ?? "Could not log incident");
        return;
      }
      setDoneAt(data.incident.created_at);
      setNotes("");
      router.refresh();
    } catch {
      setError("Network error — try again when online");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {doneAt ? (
        <div className="rounded-[1.1rem] border border-success/30 bg-success-15 px-4 py-3">
          <p className="text-sm font-extrabold text-success">
            Incident logged · {new Date(doneAt).toLocaleString()}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            High severity or accident/breakdown also alerts admin when SMS is
            live.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 rounded-[1rem] bg-light-blue-30/50 p-1">
        <button
          type="button"
          onClick={() => setMode("active")}
          className={`rounded-[0.85rem] px-3 py-2.5 text-sm font-extrabold transition ${
            mode === "active"
              ? "bg-white text-electric-blue shadow-[var(--shadow)]"
              : "text-ink-muted"
          }`}
        >
          Active bus
        </button>
        <button
          type="button"
          onClick={() => setMode("late")}
          className={`rounded-[0.85rem] px-3 py-2.5 text-sm font-extrabold transition ${
            mode === "late"
              ? "bg-white text-electric-blue shadow-[var(--shadow)]"
              : "text-ink-muted"
          }`}
        >
          Late log
        </button>
      </div>

      {mode === "active" && activeTrips.length === 0 ? (
        <div className="rounded-[1.1rem] border border-dashed border-card-border bg-white/70 px-4 py-6 text-center">
          <p className="font-extrabold text-electric-blue">No active trip</p>
          <p className="mt-2 text-sm text-ink-muted">
            Start Morning or Evening on Home, then report here — or switch to
            Late log if you are filing after the fact.
          </p>
        </div>
      ) : null}

      {mode === "late" || activeTrips.length > 0 ? (
        <>
          {mode === "late" ? (
            <p className="text-sm text-ink-muted">
              Use this when the bus is already done for the day. Pick the trip,
              when it happened, and describe what went wrong.
            </p>
          ) : (
            <p className="text-sm text-ink-muted">
              Prefer reporting while the trip is live so GPS can attach.
            </p>
          )}

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">
              Which trip?
            </span>
            <select
              value={tripId}
              onChange={(e) => setTripId(e.target.value)}
              required
              className="mt-2 w-full rounded-[var(--radius-sm)] border border-card-border bg-white px-3 py-3 text-sm font-semibold text-ink outline-none focus:border-electric-blue"
            >
              {tripOptions.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.label}
                </option>
              ))}
            </select>
          </label>

          {mode === "late" ? (
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                When did it happen?
              </span>
              <input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                required
                className="mt-2 w-full rounded-[var(--radius-sm)] border border-card-border bg-white px-3 py-3 text-sm font-semibold text-ink outline-none focus:border-electric-blue"
              />
            </label>
          ) : null}

          <fieldset>
            <legend className="text-xs font-bold uppercase tracking-wide text-ink-muted">
              What happened?
            </legend>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TYPES.map((item) => {
                const active = type === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setType(item.value)}
                    className={`rounded-[1rem] border px-3 py-3 text-left transition ${
                      active
                        ? "border-electric-blue bg-electric-blue text-white shadow-[var(--shadow)]"
                        : "border-card-border bg-white/90 text-ink hover:border-electric-blue/40"
                    }`}
                  >
                    <span className="block text-sm font-extrabold">
                      {item.label}
                    </span>
                    <span
                      className={`mt-0.5 block text-[11px] ${
                        active ? "text-white/75" : "text-ink-faint"
                      }`}
                    >
                      {item.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-bold uppercase tracking-wide text-ink-muted">
              How serious?
            </legend>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {SEVERITIES.map((item) => {
                const active = severity === item.value;
                const tone =
                  item.value === "high"
                    ? active
                      ? "border-danger bg-danger text-white"
                      : "border-danger/25 bg-danger-15 text-danger"
                    : item.value === "medium"
                      ? active
                        ? "border-gold bg-gold text-electric-blue"
                        : "border-gold/40 bg-gold-15 text-ink"
                      : active
                        ? "border-success bg-success text-white"
                        : "border-success/25 bg-success-15 text-success";
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setSeverity(item.value)}
                    className={`rounded-[1rem] border px-2 py-3 text-center transition ${tone}`}
                  >
                    <span className="block text-sm font-extrabold">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-[10px] opacity-80">
                      {item.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">
              {mode === "late" ? "Description" : "Notes"}
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              required={mode === "late"}
              placeholder="What happened, where, who needs help…"
              className="mt-2 w-full rounded-[1rem] border border-card-border bg-white px-4 py-3 text-sm text-ink outline-none focus:border-electric-blue"
            />
          </label>

          {error ? (
            <p className="text-sm font-semibold text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading || !tripId}
            className="ui-cta disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Sending…"
              : mode === "late"
                ? "Submit late incident log"
                : "Submit incident report"}
          </button>
          <p className="text-center text-xs text-ink-faint">
            {mode === "active"
              ? "Current GPS is attached when the phone allows location."
              : "Late logs store the day/time you enter with the description."}
          </p>
        </>
      ) : null}
    </form>
  );
}
