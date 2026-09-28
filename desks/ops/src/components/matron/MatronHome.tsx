"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { notifyActiveTripChanged } from "@/components/matron/ActiveTripChip";
import { BoardingHeadcount } from "@/components/matron/BoardingHeadcount";
import { BusPicker } from "@/components/fleet/BusPicker";
import { useGeolocation } from "@/components/matron/useGeolocation";
import { brand } from "@/lib/brand";
import {
  clearActiveTrip,
  loadActiveTrip,
  saveActiveTrip,
  type ActiveTrip,
} from "@/lib/matron/active-trip";
import { canStartTripDirection } from "@/lib/matron/trip-window";
import type { Bus, TripWithBus } from "@/types/database";

type Props = {
  buses: Bus[];
  trips: TripWithBus[];
  /** studentId → bus ids (live-sheet route assignments). */
  studentBusIds: Record<string, string[]>;
};

/**
 * Matron home: pick bus → start AM/PM trip → scan.
 */
export function MatronHome({
  buses,
  trips: initialTrips,
  studentBusIds,
}: Props) {
  const router = useRouter();
  const { status, requestLocation } = useGeolocation({
    requestOnMount: true,
  });

  const [busId, setBusId] = useState("");
  const [active, setActive] = useState<ActiveTrip | null>(null);
  const [trips, setTrips] = useState(initialTrips);
  const [scanHint, setScanHint] = useState<string | null>(null);
  const [startingTrip, setStartingTrip] = useState(false);
  const [staleTrip, setStaleTrip] = useState<{
    id: string;
    direction: "am" | "pm";
  } | null>(null);
  const [closingStale, setClosingStale] = useState(false);
  const autoOpenedRef = useRef<string | null>(null);

  const selectedBus = buses.find((b) => b.id === busId) ?? null;

  useEffect(() => {
    setTrips(initialTrips);
  }, [initialTrips]);

  const rosterCount = useMemo(() => {
    if (!busId) return 0;
    return Object.values(studentBusIds).filter((ids) =>
      ids.includes(busId),
    ).length;
  }, [busId, studentBusIds]);

  const metaByBusId = useMemo(() => {
    const out: Record<string, string> = {};
    for (const bus of buses) {
      const count = Object.values(studentBusIds).filter((ids) =>
        ids.includes(bus.id),
      ).length;
      out[bus.id] = `${count} students`;
    }
    return out;
  }, [buses, studentBusIds]);

  const busTripsToday = useMemo(
    () => trips.filter((t) => t.bus_id === busId),
    [trips, busId],
  );
  const activeTripToday =
    busTripsToday.find((t) => t.status === "active") ?? null;
  const openTrip = activeTripToday;

  const amStart = canStartTripDirection("am", {
    activeDirection: activeTripToday?.direction ?? null,
  });
  const pmStart = canStartTripDirection("pm", {
    activeDirection: activeTripToday?.direction ?? null,
  });

  useEffect(() => {
    const saved = loadActiveTrip();
    if (saved?.busId && buses.some((b) => b.id === saved.busId)) {
      setActive(saved);
      setBusId(saved.busId);
    }
  }, [buses]);

  useEffect(() => {
    if (!selectedBus) return;
    const saved = loadActiveTrip();
    const savedTripStillOpen =
      saved?.tripId &&
      saved.busId === selectedBus.id &&
      openTrip?.id === saved.tripId;

    const next: ActiveTrip = {
      busId: selectedBus.id,
      busLabel: selectedBus.label,
      tripId: savedTripStillOpen ? saved!.tripId : openTrip?.id,
      direction: savedTripStillOpen ? saved!.direction : openTrip?.direction,
      savedAt: new Date().toISOString(),
    };
    saveActiveTrip(next);
    notifyActiveTripChanged();
    setActive(next);
    setScanHint(null);
  }, [
    selectedBus,
    openTrip?.id,
    openTrip?.direction,
  ]);

  function chooseBus(id: string) {
    const bus = buses.find((b) => b.id === id) ?? null;
    setBusId(id);
    setScanHint(null);
    setStaleTrip(null);
    autoOpenedRef.current = null;
  }

  async function startMatronTrip(
    direction: "am" | "pm",
    opts?: { closeStaleId?: string },
  ) {
    if (!selectedBus) {
      setScanHint("Choose a bus from the list first.");
      return;
    }
    if (
      activeTripToday &&
      activeTripToday.direction === direction &&
      !opts?.closeStaleId
    ) {
      openScanForTrip(activeTripToday, selectedBus);
      return;
    }
    // The time-of-day gate only decides whether it's OK to start a FRESH
    // trip. Once something's already open today, tapping the other
    // direction should resume it, not get blocked by the clock -- the
    // server (createTrip) is what actually resumes it below.
    if (!activeTripToday) {
      const gate = canStartTripDirection(direction, { activeDirection: null });
      if (!gate.ok) {
        setScanHint(gate.reason ?? "This trip is not available yet.");
        return;
      }
    }

    setStartingTrip(true);
    setScanHint(null);
    setStaleTrip(null);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          busId: selectedBus.id,
          direction,
          closeStaleId: opts?.closeStaleId,
        }),
      });
      const data = (await res.json()) as {
        trip?: TripWithBus;
        resumedExisting?: boolean;
        error?: string;
        code?: string;
        staleTripId?: string;
      };
      if (!res.ok || !data.trip) {
        if (data.code === "open_trip_stale" && data.staleTripId) {
          setStaleTrip({ id: data.staleTripId, direction });
        }
        throw new Error(data.error ?? "Could not start trip");
      }
      setTrips((prev) => {
        const rest = prev.filter((t) => t.id !== data.trip!.id);
        return [...rest, data.trip!];
      });
      if (data.resumedExisting && data.trip.direction !== direction) {
        setScanHint(
          `This bus already has an open ${data.trip.direction.toUpperCase()} trip today -- resuming that instead of starting a new one.`,
        );
      }
      openScanForTrip(data.trip, selectedBus);
    } catch (error) {
      setScanHint(
        error instanceof Error ? error.message : "Could not start trip",
      );
    } finally {
      setStartingTrip(false);
    }
  }

  async function closeStaleAndStart() {
    if (!staleTrip) return;
    setClosingStale(true);
    try {
      await startMatronTrip(staleTrip.direction, {
        closeStaleId: staleTrip.id,
      });
    } finally {
      setClosingStale(false);
    }
  }

  function openScanForTrip(trip: TripWithBus, bus: Bus) {
    if (autoOpenedRef.current === trip.id) return;
    autoOpenedRef.current = trip.id;
    saveActiveTrip({
      tripId: trip.id,
      busId: bus.id,
      busLabel: bus.label,
      direction: trip.direction,
      savedAt: new Date().toISOString(),
    });
    notifyActiveTripChanged();
    router.push(`/matron/scan?tripId=${trip.id}`);
  }

  const gpsReady = status === "granted";
  const canScan = Boolean(selectedBus && openTrip);

  const heroTitle = openTrip
    ? "Trip in progress"
    : selectedBus
      ? "Ready to roll"
      : "Choose your bus";

  const heroBody = openTrip
    ? `${selectedBus?.label ?? "Bus"} · ${openTrip.direction.toUpperCase()} — Scan to board students, Path for GPS navigation. PM runs the route in reverse (last pickup stop first).`
    : selectedBus
      ? `${selectedBus.label} selected. Start Morning (pickup → school) or Afternoon (school → drop-off) — scan, navigate, and end the trip here.`
      : "Scroll the full bus list below and tap the bus you are boarding today.";

  return (
    <main className="matron-page">
      <section
        className={`ui-rise relative overflow-hidden rounded-[1.25rem] border px-5 py-6 text-white shadow-[var(--shadow-lg)] sm:px-7 ${
          openTrip
            ? "border-success/40 bg-gradient-to-br from-success via-electric-blue to-navy-dark"
            : "border-white/25 bg-gradient-to-br from-navy-light via-electric-blue to-navy-dark"
        }`}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-gold/20 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-4 opacity-[0.12]"
          style={{
            width: "5rem",
            height: "5rem",
            backgroundImage: `url(${brand.logos.logomarkWhite ?? brand.logos.logomarkElectricBlue})`,
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
          }}
        />
        <div className="relative z-10 max-w-lg">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-light-blue/90">
            Today on bus duty
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
            {heroTitle}
          </h1>
          <p className="mt-2 text-sm text-white/85">{heroBody}</p>

          {selectedBus ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex min-h-9 items-center rounded-full bg-white/15 px-3 text-xs font-bold text-white">
                {selectedBus.label}
                {selectedBus.plate_number
                  ? ` · ${selectedBus.plate_number}`
                  : ""}
              </span>
              <span className="inline-flex min-h-9 items-center rounded-full bg-white/15 px-3 text-xs font-bold text-white">
                {rosterCount} students
              </span>
              {openTrip ? (
                <>
                  <Link
                    href={`/matron/scan?tripId=${openTrip.id}`}
                    className="inline-flex min-h-9 items-center rounded-full bg-gold px-3 text-xs font-extrabold text-electric-blue no-underline"
                  >
                    Open Scan →
                  </Link>
                  <Link
                    href={`/matron/path?tripId=${openTrip.id}`}
                    className="inline-flex min-h-9 items-center rounded-full bg-white/15 px-3 text-xs font-extrabold text-white no-underline"
                  >
                    Open Path →
                  </Link>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setBusId("");
                  clearActiveTrip();
                  notifyActiveTripChanged();
                  setActive(null);
                }}
                className="inline-flex min-h-9 items-center rounded-full border border-white/40 px-3 text-xs font-bold text-white"
              >
                Change bus
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold">
        <StatusPill ok={Boolean(selectedBus)} label="Bus" />
        <StatusPill
          ok={rosterCount > 0}
          label={rosterCount > 0 ? `${rosterCount} students` : "Students"}
        />
        <StatusPill
          ok={gpsReady}
          label={gpsReady ? "GPS on" : "GPS"}
        />
        <StatusPill
          ok={Boolean(openTrip)}
          label={
            openTrip
              ? `Trip ${openTrip.direction.toUpperCase()}`
              : "No trip yet"
          }
        />
        <button
          type="button"
          onClick={() => {
            if (!gpsReady) requestLocation();
          }}
          className={`rounded-full px-2.5 py-1 ${
            gpsReady ? "bg-success-15 text-success" : "bg-gold-15 text-ink"
          }`}
        >
          {gpsReady ? "Location OK" : "Allow GPS"}
        </button>
      </div>

      <div className="mt-4">
        <BusPicker
          buses={buses}
          selectedBusId={busId}
          onSelect={chooseBus}
          metaByBusId={metaByBusId}
          title="Choose your bus"
          hint="Scroll every bus and tap yours. Search only if you want to narrow the list."
        />
      </div>

      <section className="matron-surface mt-3 p-4 sm:p-5">
        <p className="text-sm font-bold text-electric-blue">Start scanning</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {selectedBus
            ? openTrip
              ? `${selectedBus.label} · ${openTrip.direction.toUpperCase()} trip open — scan students, then end trip when done.`
              : `Start a Morning or Afternoon trip for ${selectedBus.label}.`
            : "Pick a bus from the list above first."}
        </p>

        {selectedBus ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={startingTrip || (!activeTripToday && !amStart.ok)}
              title={!activeTripToday && !amStart.ok ? amStart.reason : undefined}
              onClick={() => void startMatronTrip("am")}
              className={`matron-btn-primary ${
                !activeTripToday && !amStart.ok
                  ? "cursor-not-allowed opacity-45"
                  : ""
              }`}
            >
              {activeTripToday?.direction === "am"
                ? "Scan · Morning"
                : startingTrip
                  ? "Starting…"
                  : "Start · Morning"}
            </button>
            <button
              type="button"
              disabled={startingTrip || (!activeTripToday && !pmStart.ok)}
              title={!activeTripToday && !pmStart.ok ? pmStart.reason : undefined}
              onClick={() => void startMatronTrip("pm")}
              className={`matron-btn-secondary w-full ${
                !activeTripToday && !pmStart.ok
                  ? "cursor-not-allowed opacity-45"
                  : ""
              }`}
            >
              {activeTripToday?.direction === "pm"
                ? "Scan · Afternoon"
                : startingTrip
                  ? "Starting…"
                  : "Start · Afternoon"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled
            className="matron-btn-primary mt-4"
          >
            Choose a bus first
          </button>
        )}

        {canScan ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => openScanForTrip(openTrip!, selectedBus!)}
              className="matron-btn-secondary w-full"
            >
              Open scanner · {selectedBus!.label}
            </button>
            <Link
              href={`/matron/path?tripId=${openTrip!.id}`}
              className="matron-btn-secondary w-full text-center no-underline"
            >
              Open path · GPS
            </Link>
          </div>
        ) : null}

        {scanHint ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {scanHint}
          </p>
        ) : null}

        {staleTrip ? (
          <button
            type="button"
            disabled={closingStale}
            onClick={() => void closeStaleAndStart()}
            className="matron-btn-secondary mt-2 w-full"
          >
            {closingStale ? "Closing…" : "Close old trip & start today's"}
          </button>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={
              busId ? `/matron/students?busId=${busId}` : "/matron/students"
            }
            className="matron-btn-secondary"
          >
            View roster
          </Link>
          <Link href="/matron/incidents" className="matron-btn-secondary">
            Report issue
          </Link>
        </div>
      </section>

      {active?.tripId ? (
        <div className="mt-3">
          <BoardingHeadcount tripId={active.tripId} />
        </div>
      ) : null}
    </main>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 ${
        ok ? "bg-success-15 text-success" : "bg-[var(--track)] text-ink-muted"
      }`}
    >
      {ok ? "✓ " : ""}
      {label}
    </span>
  );
}
