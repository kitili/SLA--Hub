"use client";

import { formatCoords, type GeoStatus } from "@/lib/geo/format";

type Props = {
  status: GeoStatus;
  lat?: number;
  lng?: number;
  accuracy?: number;
  error?: string | null;
  onRetry: () => void;
};

const copy: Record<GeoStatus, string> = {
  idle: "Location off",
  loading: "Finding location…",
  granted: "Location on",
  denied: "Location blocked",
  unavailable: "GPS unavailable",
};

export function GeolocationBanner({
  status,
  lat,
  lng,
  accuracy,
  error,
  onRetry,
}: Props) {
  const ok = status === "granted";
  const bad = status === "denied" || status === "unavailable";

  return (
    <section
      className={`matron-surface flex items-center justify-between gap-3 px-3.5 py-3 ${
        bad ? "border-danger/25" : ""
      }`}
      aria-live="polite"
    >
      <div className="min-w-0">
        <p
          className={`text-sm font-semibold ${
            ok ? "text-success" : bad ? "text-danger" : "text-ink"
          }`}
        >
          {copy[status]}
        </p>
        {ok && lat != null && lng != null ? (
          <p className="mt-0.5 truncate font-mono text-[11px] text-ink-faint">
            {formatCoords(lat, lng)}
            {accuracy != null ? ` · ±${Math.round(accuracy)}m` : ""}
          </p>
        ) : null}
        {error ? <p className="mt-1 text-xs text-ink-muted">{error}</p> : null}
        {status === "denied" ? (
          <p className="mt-1 text-xs text-ink-muted">
            Allow location in browser settings to stamp boarding scans.
          </p>
        ) : null}
      </div>
      {status !== "loading" && status !== "granted" ? (
        <button
          type="button"
          onClick={onRetry}
          className="matron-btn-secondary shrink-0 !min-h-9 px-3 text-xs"
        >
          Allow
        </button>
      ) : null}
    </section>
  );
}
