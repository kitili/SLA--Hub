/**
 * Single-slot localStorage outbox for "end trip" during brief offline
 * (phone call, tunnel, flaky data) -- same idea as boarding-outbox.ts, but
 * a matron only ever has one trip open at a time, so no queue is needed,
 * just one pending completion that retries until it lands.
 */

const KEY = "matron.pendingTripComplete";

export type PendingTripComplete = {
  tripId: string;
  lat: number | null;
  lng: number | null;
  queuedAt: string;
};

export function savePendingComplete(row: PendingTripComplete) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(row));
  } catch {
    /* best-effort */
  }
}

export function loadPendingComplete(tripId?: string): PendingTripComplete | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingTripComplete;
    if (!parsed?.tripId) return null;
    if (tripId && parsed.tripId !== tripId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingComplete() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Attempts to send a pending "end trip" for this tripId, if one is queued.
 * Returns "sent" (cleared, caller should finish the UI transition), "none"
 * (nothing queued), or "failed" (still offline/erroring, left queued to
 * retry later) with the error message for display.
 */
export async function flushPendingComplete(
  tripId: string,
): Promise<{ status: "sent" | "none" | "failed"; error?: string }> {
  const pending = loadPendingComplete(tripId);
  if (!pending) return { status: "none" };

  try {
    const res = await fetch(`/api/trips/${tripId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: pending.lat,
        lng: pending.lng,
        endedAt: pending.queuedAt,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      // Already completed/cancelled/not found -- retrying won't help, drop it.
      const err = (data.error ?? "").toLowerCase();
      if (
        err.includes("already") ||
        err.includes("not found") ||
        err.includes("cancelled")
      ) {
        clearPendingComplete();
        return { status: "sent" };
      }
      return { status: "failed", error: data.error ?? "End trip sync failed" };
    }
    clearPendingComplete();
    return { status: "sent" };
  } catch {
    return { status: "failed", error: "Network error ending trip" };
  }
}
