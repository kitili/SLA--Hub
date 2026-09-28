"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DriverGoogleMap } from "@/components/driver/DriverGoogleMap";
import { DriverConnectivityBanner } from "@/components/driver/DriverConnectivityBanner";
import { useDriverLocationTracker } from "@/components/driver/useDriverLocationTracker";
import { notifyActiveTripChanged } from "@/components/matron/ActiveTripChip";
import {
  clearActiveTrip,
  loadActiveTrip,
  saveActiveTrip,
} from "@/lib/matron/active-trip";
import {
  flushPendingComplete,
  savePendingComplete,
} from "@/lib/matron/trip-complete-outbox";
import {
  googleMapsDirectionsUrl,
  stopKindLabel,
  tripDirectionLabel,
} from "@/lib/driver/stop-labels";
import { haversineKm } from "@/lib/routing/optimize";
import { TYPES } from "@/components/matron/ReportIncidentForm";
import type { IncidentType } from "@/types/database";

const ARRIVE_RADIUS_KM = 0.08;
const ASSUMED_SPEED_KMH = 25;

function defaultSeverityForType(type: IncidentType): "low" | "medium" | "high" {
  return type === "accident" || type === "medical" ? "high" : "medium";
}

function notesPlaceholderForType(type: IncidentType): string {
  if (type === "accident") {
    return "What happened, is anyone hurt, is the other vehicle/driver identified?";
  }
  if (type === "breakdown") {
    return "What broke, can the bus still move, do you need a replacement bus?";
  }
  if (type === "medical") {
    return "Who needs help, what's the symptom, do you need an ambulance?";
  }
  return "Traffic, road closed, waiting for students…";
}

function notesRequiredForType(type: IncidentType): boolean {
  return type === "accident" || type === "breakdown" || type === "medical";
}

type StopRow = {
  order: number;
  eta_offset_minutes: number | null;
  eta_clock?: string | null;
  id: string;
  name: string;
  kind: string;
  lat: number | null;
  lng: number | null;
};

type Props = {
  initialTripId?: string | null;
};

/** Live route map + stop navigation inside the matron app. */
export function MatronPathNavigate({ initialTripId }: Props) {
  const router = useRouter();
  const [tripId, setTripId] = useState<string | null>(initialTripId ?? null);
  const [busLabel, setBusLabel] = useState<string>("");
  const [direction, setDirection] = useState<string>("");
  const [tripStatus, setTripStatus] = useState<string | null>(null);
  const [routeName, setRouteName] = useState<string | null>(null);
  const [stops, setStops] = useState<StopRow[]>([]);
  const [doneStopIds, setDoneStopIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [departing, setDeparting] = useState(false);
  const [arriving, setArriving] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportNote, setReportNote] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMsg, setReportMsg] = useState<string | null>(null);
  const [reportType, setReportType] = useState<IncidentType>("delay");
  const [routeId, setRouteId] = useState<string | null>(null);
  const [loggingRoute, setLoggingRoute] = useState(false);

  const tripEnded = tripStatus === "completed";
  const tracker = useDriverLocationTracker({
    tripId,
    enabled: Boolean(tripId) && !tripEnded,
  });

  useEffect(() => {
    if (tripId) return;
    const saved = loadActiveTrip();
    if (saved?.tripId) {
      setTripId(saved.tripId);
      setBusLabel(saved.busLabel);
      setDirection(saved.direction ?? "");
    }
  }, [tripId]);

  useEffect(() => {
    setDoneStopIds([]);
  }, [tripId]);

  const loadStops = useCallback(async () => {
    if (!tripId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/stops`);
      const data = (await res.json()) as {
        error?: string;
        trip?: {
          status: string;
          direction: string;
          bus_label?: string;
        };
        route_name?: string | null;
        route_id?: string | null;
        stops?: StopRow[];
      };
      if (!res.ok) {
        setError(data.error ?? "Could not load your stops");
        return;
      }
      setStops(data.stops ?? []);
      setTripStatus(data.trip?.status ?? null);
      setDirection(data.trip?.direction ?? "");
      setBusLabel(data.trip?.bus_label ?? busLabel);
      setRouteName(data.route_name ?? null);
      setRouteId(data.route_id ?? null);

      const saved = loadActiveTrip();
      if (saved && data.trip) {
        saveActiveTrip({
          ...saved,
          tripId,
          busLabel: data.trip.bus_label ?? saved.busLabel,
          direction: (data.trip.direction as "am" | "pm") ?? saved.direction,
          savedAt: new Date().toISOString(),
        });
        notifyActiveTripChanged();
      }
    } catch {
      setError("Network error — check your connection and try again");
    } finally {
      setLoading(false);
    }
  }, [tripId, busLabel]);

  useEffect(() => {
    void loadStops();
  }, [loadStops]);

  const remainingStops = useMemo(
    () => stops.filter((s) => !doneStopIds.includes(s.id)),
    [stops, doneStopIds],
  );

  const mapStops = useMemo(
    () =>
      remainingStops.map((s) => ({
        id: s.id,
        name: s.name,
        order: s.order,
        lat: s.lat,
        lng: s.lng,
      })),
    [remainingStops],
  );

  const nextStop = remainingStops[0] ?? null;
  const upcoming = remainingStops.slice(0, 6);

  const driverLocation = useMemo(() => {
    const c = tracker.lastCoords;
    if (!c) return null;
    return {
      lat: c.latitude,
      lng: c.longitude,
      heading: c.heading,
    };
  }, [tracker.lastCoords]);

  const liveToNext = useMemo(() => {
    if (
      !driverLocation ||
      nextStop?.lat == null ||
      nextStop?.lng == null ||
      !Number.isFinite(nextStop.lat) ||
      !Number.isFinite(nextStop.lng)
    ) {
      return null;
    }
    const km = haversineKm(
      { lat: driverLocation.lat, lng: driverLocation.lng },
      { lat: nextStop.lat, lng: nextStop.lng },
    );
    const minutes = Math.max(1, Math.round((km / ASSUMED_SPEED_KMH) * 60));
    return { km, minutes };
  }, [driverLocation, nextStop]);

  useEffect(() => {
    if (!nextStop || !liveToNext) return;
    if (liveToNext.km <= ARRIVE_RADIUS_KM) {
      setDoneStopIds((prev) =>
        prev.includes(nextStop.id) ? prev : [...prev, nextStop.id],
      );
    }
  }, [nextStop, liveToNext]);

  function markArrived() {
    if (!nextStop) return;
    setDoneStopIds((prev) =>
      prev.includes(nextStop.id) ? prev : [...prev, nextStop.id],
    );
  }

  function openInGoogleMaps() {
    const url = googleMapsDirectionsUrl({
      stops: remainingStops,
      origin: driverLocation,
    });
    if (!url && nextStop?.lat != null && nextStop.lng != null) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${nextStop.lat},${nextStop.lng}&travelmode=driving`,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  async function logDiscoveredRoute() {
    if (!tripId) return;
    const note = window.prompt(
      "Describe the new / changed path (e.g. road closed — used Leganga bypass):",
    );
    if (!note?.trim()) return;
    setLoggingRoute(true);
    setReportMsg(null);
    try {
      const res = await fetch("/api/route-change-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeId,
          eventType: "discovered",
          summary: note.trim(),
          meta: {
            trip_id: tripId,
            bus_label: busLabel,
            direction,
            lat: tracker.lastCoords?.latitude ?? null,
            lng: tracker.lastCoords?.longitude ?? null,
          },
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string; hint?: string };
        setError([data.error, data.hint].filter(Boolean).join(" "));
        return;
      }
      setReportMsg("New route path logged for the transport office.");
    } finally {
      setLoggingRoute(false);
    }
  }

  async function leaveSchool() {
    if (!tripId) return;
    setDeparting(true);
    try {
      await fetch(`/api/trips/${tripId}/depart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: tracker.lastCoords?.latitude ?? null,
          lng: tracker.lastCoords?.longitude ?? null,
        }),
      });
      await loadStops();
    } finally {
      setDeparting(false);
    }
  }

  async function markArrivedAtSchool() {
    if (!tripId) return;
    setArriving(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/arrive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Could not mark arrival");
        return;
      }
      await loadStops();
    } finally {
      setArriving(false);
    }
  }

  function finishEndTrip() {
    clearActiveTrip();
    notifyActiveTripChanged();
    setTripStatus("completed");
    router.push("/matron");
    router.refresh();
  }

  async function endTrip() {
    if (!tripId) return;
    setEnding(true);
    setError(null);
    const lat = tracker.lastCoords?.latitude ?? null;
    const lng = tracker.lastCoords?.longitude ?? null;

    // Offline: don't even try the request -- queue it now so it isn't lost
    // to a silent failure, same as boarding scans already do.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      savePendingComplete({ tripId, lat, lng, queuedAt: new Date().toISOString() });
      setError("Saved offline -- will finish ending the trip once you're back online.");
      setEnding(false);
      return;
    }

    try {
      const res = await fetch(`/api/trips/${tripId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });
      if (res.ok) {
        finishEndTrip();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        missingStudents?: { id: string; name: string }[];
      };
      if (data.code === "incomplete_roster") {
        const names = (data.missingStudents ?? []).map((s) => s.name).join(", ");
        const reason = window.prompt(
          `Not scanned: ${names}\n\nWhy weren't they scanned? (this goes to the transport office)`,
        );
        if (reason?.trim()) {
          const retry = await fetch(`/api/trips/${tripId}/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat, lng, incompleteRosterReason: reason.trim() }),
          });
          if (retry.ok) {
            finishEndTrip();
            return;
          }
          const retryData = (await retry.json().catch(() => ({}))) as { error?: string };
          setError(retryData.error ?? "Could not end the trip -- tap End Trip to try again.");
        } else {
          setError(data.error ?? "Could not end the trip -- tap End Trip to try again.");
        }
        return;
      }
      setError(data.error ?? "Could not end the trip -- tap End Trip to try again.");
    } catch {
      // Network blip, not a real offline state -- queue and retry rather
      // than leaving the trip silently stuck open (the original bug here).
      savePendingComplete({ tripId, lat, lng, queuedAt: new Date().toISOString() });
      setError("Network dropped -- saved and will finish ending the trip automatically.");
    } finally {
      setEnding(false);
    }
  }

  useEffect(() => {
    if (!tripId || tripEnded) return;
    const tryFlush = async () => {
      const result = await flushPendingComplete(tripId);
      if (result.status === "sent") finishEndTrip();
    };
    void tryFlush();
    const onOnline = () => void tryFlush();
    window.addEventListener("online", onOnline);
    const t = window.setInterval(() => void tryFlush(), 20_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, tripEnded]);

  async function reportIncident() {
    if (!tripId) return;
    setReporting(true);
    setReportMsg(null);
    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          type: reportType,
          severity: defaultSeverityForType(reportType),
          notes:
            reportNote.trim() ||
            (reportType === "delay"
              ? "Matron reported a delay"
              : "Matron reported an incident"),
          lat: tracker.lastCoords?.latitude ?? null,
          lng: tracker.lastCoords?.longitude ?? null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setReportMsg(data.error ?? "Could not send report");
        return;
      }
      setReportMsg("Report sent to the transport office.");
      setReportNote("");
      setReportOpen(false);
      setReportType("delay");
    } catch {
      setReportMsg("Network error — try again");
    } finally {
      setReporting(false);
    }
  }

  if (!tripId) {
    return (
      <main className="matron-page px-4 py-10 text-center">
        <h1 className="font-display text-2xl font-extrabold text-electric-blue">
          No active trip
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Start Morning or Afternoon from Home, then open Path for navigation.
        </p>
        <Link href="/matron" className="matron-btn-primary mt-6 inline-flex">
          Go to Home
        </Link>
      </main>
    );
  }

  const locationLabel =
    tracker.status === "tracking"
      ? "Sharing location"
      : tracker.status === "denied"
        ? "Location off"
        : tracker.online
          ? "Getting location…"
          : "Offline";

  const etaDisplay =
    liveToNext != null
      ? `~${liveToNext.minutes} min`
      : (nextStop?.eta_clock ?? "—");

  return (
    <main className="matron-page ui-rise pb-2">
      <DriverConnectivityBanner
        queuedCount={tracker.queuedCount}
        gpsStatus={tracker.status}
      />

      <div className="px-3 pt-3">
        <DriverGoogleMap
          stops={mapStops}
          driverLocation={driverLocation}
          height="min(48vh, 26rem)"
        />
      </div>

      <section className="mx-3 mt-3 rounded-[1.35rem] bg-gradient-to-br from-[#001a4d] via-electric-blue to-[#003a8c] px-4 pb-5 pt-4 text-white shadow-[var(--shadow-lg)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold">
              Next stop
            </p>
            <h1 className="mt-1 truncate font-display text-2xl font-extrabold tracking-tight text-white">
              {loading ? "Loading…" : (nextStop?.name ?? "All stops done")}
            </h1>
            <p className="mt-1 text-sm text-white/75">
              {[busLabel, tripDirectionLabel(direction), routeName]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {liveToNext != null ? (
              <p className="mt-1 text-sm font-semibold text-gold">
                {liveToNext.km < 1
                  ? `${Math.round(liveToNext.km * 1000)} m away`
                  : `${liveToNext.km.toFixed(1)} km away`}
              </p>
            ) : null}
          </div>
          <div className="shrink-0 rounded-2xl bg-white/10 px-3 py-2 text-right ring-1 ring-white/15">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">
              Arrive
            </p>
            <p className="font-display text-xl font-extrabold text-gold">
              {etaDisplay}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!nextStop}
            onClick={openInGoogleMaps}
            className="min-h-12 rounded-xl bg-gold px-3 text-sm font-extrabold text-electric-blue disabled:opacity-40"
          >
            Navigate
          </button>
          <button
            type="button"
            disabled={!nextStop || tripEnded}
            onClick={markArrived}
            className="min-h-12 rounded-xl border border-white/30 bg-white/10 px-3 text-sm font-bold text-white disabled:opacity-40"
          >
            I&apos;m here
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
          <span
            className={`rounded-full px-2.5 py-1 ${
              tracker.status === "tracking"
                ? "bg-white/15 text-white"
                : "bg-gold/25 text-gold"
            }`}
          >
            {locationLabel}
          </span>
          {tracker.lastPingAt ? (
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-white">
              GPS {new Date(tracker.lastPingAt).toLocaleTimeString()}
            </span>
          ) : null}
          {doneStopIds.length > 0 ? (
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-white">
              {doneStopIds.length} completed
            </span>
          ) : null}
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-white">
            {remainingStops.length} left
          </span>
        </div>
      </section>

      <div className="space-y-3 px-3 py-4">
        {tracker.error ? (
          <p className="rounded-xl bg-gold-15 px-3 py-2 text-sm text-ink">
            {tracker.error}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-xl bg-danger-15 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {reportMsg ? (
          <p className="rounded-xl bg-success-15 px-3 py-2 text-sm text-success">
            {reportMsg}
          </p>
        ) : null}

        <section className="matron-surface p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-electric-blue">
              Upcoming stops
            </h2>
            <Link
              href={`/matron/scan?tripId=${tripId}`}
              className="text-xs font-bold text-electric-blue no-underline"
            >
              Open Scan →
            </Link>
          </div>
          <ol className="space-y-2">
            {upcoming.map((stop, i) => (
              <li
                key={stop.id}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                  i === 0
                    ? "bg-electric-blue text-white"
                    : "bg-[#f7f9fc] text-ink"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                    i === 0
                      ? "bg-gold text-electric-blue"
                      : "bg-white text-electric-blue ring-1 ring-card-border"
                  }`}
                >
                  {stop.order + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{stop.name}</span>
                  <span
                    className={`block text-xs ${
                      i === 0 ? "text-white/70" : "text-ink-muted"
                    }`}
                  >
                    {stopKindLabel(stop.kind)}
                    {stop.eta_clock ? ` · ${stop.eta_clock}` : ""}
                  </span>
                </span>
              </li>
            ))}
            {remainingStops.length === 0 && !loading ? (
              <li className="px-2 py-4 text-center text-sm text-ink-muted">
                {stops.length === 0
                  ? "No stops on this bus route yet. Contact the transport office."
                  : "All stops done — end trip on Scan when boarding is finished."}
              </li>
            ) : null}
          </ol>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={departing || tripEnded}
            onClick={() => void leaveSchool()}
            className="matron-btn-secondary min-h-12"
          >
            {departing ? "…" : "Left school"}
          </button>
          <button
            type="button"
            disabled={arriving || tripEnded}
            onClick={() => void markArrivedAtSchool()}
            className="matron-btn-secondary min-h-12"
          >
            {arriving ? "…" : "Arrived at school"}
          </button>
          <button
            type="button"
            disabled={loggingRoute || !tripId}
            onClick={() => void logDiscoveredRoute()}
            className="matron-btn-secondary min-h-12"
          >
            {loggingRoute ? "…" : "Log new path"}
          </button>
        </div>
        <button
          type="button"
          disabled={ending || tripEnded}
          onClick={() => void endTrip()}
          className="matron-btn-primary min-h-12 w-full"
        >
          {ending ? "Ending…" : "End trip"}
        </button>

        <button
          type="button"
          disabled={tripEnded}
          onClick={() => setReportOpen((v) => !v)}
          className="matron-btn-secondary min-h-11 w-full"
        >
          {reportOpen ? "Cancel" : "Report incident"}
        </button>

        {reportOpen ? (
          <div className="matron-surface p-3">
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((item) => {
                const active = reportType === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setReportType(item.value)}
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
            <label className="mt-3 block text-sm">
              <span className="font-semibold text-ink">What happened?</span>
              <textarea
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                rows={3}
                placeholder={notesPlaceholderForType(reportType)}
                className="mt-1.5 w-full rounded-xl border border-[#d8dee8] bg-[#f7f9fc] px-3 py-2 text-sm text-ink outline-none focus:border-light-blue"
              />
            </label>
            {notesRequiredForType(reportType) && !reportNote.trim() ? (
              <p className="mt-1 text-xs font-semibold text-danger">
                Please describe what happened before sending.
              </p>
            ) : null}
            <button
              type="button"
              disabled={
                reporting ||
                (notesRequiredForType(reportType) && !reportNote.trim())
              }
              onClick={() => void reportIncident()}
              className="matron-btn-primary mt-2 min-h-11 w-full"
            >
              {reporting ? "Sending…" : "Send to office"}
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
