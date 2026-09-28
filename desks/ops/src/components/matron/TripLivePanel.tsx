"use client";

import { useCallback, useEffect, useState } from "react";
import { useDriverLocationTracker } from "@/components/driver/useDriverLocationTracker";
import {
  buildTripRunLog,
  formatScanClock,
} from "@/lib/transport/trip-run";
import { refreshScannedCodesFromServer } from "@/lib/matron/scanned-codes";

type ScanRow = {
  id: string;
  student_name: string;
  class_name: string | null;
  event_type: "in" | "out";
  scanned_at: string;
  lat: number | null;
  lng: number | null;
  stop_name: string | null;
  location_source: "scan" | "trail" | null;
};

type Props = {
  tripId: string;
  direction?: "am" | "pm" | string | null;
};

function formatScanTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Live scan log for matron scan -- flat, chronological, each scan with its
 * resolved location. Used to group by stop and silently drop any scan it
 * couldn't match, undercounting who'd actually boarded (a real complaint
 * from a live pilot run) -- this reads from listBoardingEventsForTrip
 * instead, which never drops a scan for lack of a stop match.
 */
export function TripLivePanel({ tripId, direction }: Props) {
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tripStatus, setTripStatus] = useState<string | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidError, setVoidError] = useState<string | null>(null);

  const tripEnded = tripStatus === "completed";
  const { status, lastPingAt, pingCount, error, queuedCount } =
    useDriverLocationTracker({
      tripId,
      enabled: !tripEnded,
    });

  const loadBoarding = useCallback(async () => {
    try {
      const [scanLogRes, stopsRes] = await Promise.all([
        fetch(`/api/trips/${tripId}/scan-log`),
        fetch(`/api/trips/${tripId}/stops`),
      ]);
      const scanLog = (await scanLogRes.json()) as {
        scans?: ScanRow[];
        error?: string;
      };
      const tripMeta = (await stopsRes.json()) as {
        trip?: { status?: string | null };
      };
      if (scanLogRes.ok) {
        setScans(scanLog.scans ?? []);
      }
      if (stopsRes.ok) {
        setTripStatus(tripMeta.trip?.status ?? null);
      }
    } catch {
      // keep previous
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  async function undoScan(eventId: string, studentName: string) {
    if (!window.confirm(`Remove ${studentName}'s scan? This can't be undone.`)) {
      return;
    }
    setVoidingId(eventId);
    setVoidError(null);
    try {
      const res = await fetch(`/api/boarding/${eventId}/void`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setVoidError(data.error ?? "Could not remove that scan");
        return;
      }
      // The voided student's QR code should be re-scannable again this
      // session, not just after the next reload.
      await refreshScannedCodesFromServer(tripId);
      await loadBoarding();
    } catch {
      setVoidError("Network error — try again");
    } finally {
      setVoidingId(null);
    }
  }

  useEffect(() => {
    void loadBoarding();
    const id = window.setInterval(() => void loadBoarding(), 15_000);
    function onBoarded() {
      void loadBoarding();
    }
    window.addEventListener("matron-boarding", onBoarded);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("matron-boarding", onBoarded);
    };
  }, [loadBoarding]);

  const liveLabel =
    status === "tracking"
      ? `Live · ${pingCount} ping${pingCount === 1 ? "" : "s"}${queuedCount > 0 ? ` · ${queuedCount} queued` : ""}`
      : status === "denied"
        ? "Location blocked"
        : status === "error"
          ? "Ping error"
          : status === "unsupported"
            ? "No GPS"
            : "Getting GPS…";

  const totalBoarded = scans.length;
  const run = buildTripRunLog({
    direction: direction ?? "am",
    scans: scans.map((s) => ({
      id: s.id,
      studentName: s.student_name,
      scannedAt: s.scanned_at,
      eventType: s.event_type,
    })),
  });

  return (
    <div className="space-y-3">
      <div className="matron-surface px-4 py-3.5">
        <p className="matron-kicker">Live boarding</p>
        <p className="mt-1 text-base font-bold text-electric-blue">{liveLabel}</p>
        <p className="mt-1 text-sm text-ink-muted">
          {direction === "pm"
            ? "Afternoon: last morning pickup is first drop-off."
            : "Morning: first pickup → last pickup → bus enters school."}
          {totalBoarded > 0 ? ` ${totalBoarded} scanned.` : ""}
        </p>
        {run.first ? (
          <p className="mt-2 text-xs font-semibold text-ink">
            {run.first.label}: {run.first.studentName}{" "}
            <span className="font-mono font-normal text-ink-faint">
              {formatScanClock(run.first.scannedAt)}
            </span>
            {run.last && run.last.id !== run.first.id ? (
              <>
                {" "}
                → {run.last.label}: {run.last.studentName}{" "}
                <span className="font-mono font-normal text-ink-faint">
                  {formatScanClock(run.last.scannedAt)}
                </span>
              </>
            ) : null}
          </p>
        ) : null}
        {lastPingAt ? (
          <p className="mt-2 text-xs font-semibold text-ink-faint">
            GPS · {new Date(lastPingAt).toLocaleTimeString()}
          </p>
        ) : null}
        {error ? (
          <p className="mt-2 text-xs text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <section className="matron-surface space-y-3 p-4">
        <div>
          <p className="text-sm font-semibold text-ink">Scan log</p>
          <p className="mt-1 text-xs text-ink-muted">
            Every scan on this trip, most recent first. Updates as you scan.
          </p>
          {voidError ? (
            <p className="mt-1 text-xs font-semibold text-danger" role="alert">
              {voidError}
            </p>
          ) : null}
        </div>

        {loading && scans.length === 0 ? (
          <p className="text-sm text-ink-muted">Loading scans…</p>
        ) : scans.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Scan a student — they&apos;ll appear here.
          </p>
        ) : (
          <ol className="max-h-80 space-y-1 overflow-y-auto">
            {[...scans]
              .sort(
                (a, b) =>
                  new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime(),
              )
              .map((scan) => (
                <li
                  key={scan.id}
                  className="rounded-[var(--radius-sm)] border border-card-border bg-white px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 font-medium text-ink">
                      <span
                        className={`mr-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          scan.event_type === "in"
                            ? "bg-success-15 text-success"
                            : "bg-light-blue-30 text-electric-blue"
                        }`}
                      >
                        {scan.event_type === "in" ? "In" : "Out"}
                      </span>
                      {scan.student_name}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <time
                        dateTime={scan.scanned_at}
                        className="font-mono text-xs tabular-nums text-ink-faint"
                      >
                        {formatScanTime(scan.scanned_at)}
                      </time>
                      <button
                        type="button"
                        disabled={voidingId === scan.id || tripEnded}
                        onClick={() => void undoScan(scan.id, scan.student_name)}
                        className="text-xs font-semibold text-danger disabled:opacity-40"
                      >
                        {voidingId === scan.id ? "…" : "Remove"}
                      </button>
                    </span>
                  </div>
                  {scan.stop_name ? (
                    <p className="mt-0.5 text-xs text-ink-faint">
                      Near {scan.stop_name}
                    </p>
                  ) : null}
                </li>
              ))}
          </ol>
        )}
      </section>
    </div>
  );
}
