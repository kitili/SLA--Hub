import type { TripDirection } from "@/types/database";

const SESSION_KEY = "matron.activeTrip";
const LOCAL_KEY = "matron.activeTrip.v2";

/** Duty bus (+ optional open trip) for Matron scan/roster scoping. */
export type ActiveTrip = {
  /** Present once the driver has started a trip for this bus. */
  tripId?: string;
  busId: string;
  busLabel: string;
  direction?: TripDirection;
  savedAt: string;
};

function read(raw: string | null): ActiveTrip | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ActiveTrip;
    if (!parsed?.busId?.trim()) return null;
    return {
      tripId: parsed.tripId?.trim() || undefined,
      busId: parsed.busId,
      busLabel: parsed.busLabel || "Bus",
      direction: parsed.direction,
      savedAt: parsed.savedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveActiveTrip(trip: ActiveTrip) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify(trip);
  sessionStorage.setItem(SESSION_KEY, payload);
  localStorage.setItem(LOCAL_KEY, payload);
}

function readLegacyDriverTrip(): ActiveTrip | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("driver.activeTrip");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      tripId?: string;
      busId?: string;
      busLabel?: string;
      direction?: TripDirection;
      savedAt?: string;
    };
    if (!parsed?.busId?.trim()) return null;
    const migrated: ActiveTrip = {
      tripId: parsed.tripId?.trim() || undefined,
      busId: parsed.busId,
      busLabel: parsed.busLabel || "Bus",
      direction: parsed.direction,
      savedAt: parsed.savedAt || new Date().toISOString(),
    };
    saveActiveTrip(migrated);
    localStorage.removeItem("driver.activeTrip");
    return migrated;
  } catch {
    return null;
  }
}

export function loadActiveTrip(): ActiveTrip | null {
  if (typeof window === "undefined") return null;
  return (
    read(sessionStorage.getItem(SESSION_KEY)) ??
    read(localStorage.getItem(LOCAL_KEY)) ??
    readLegacyDriverTrip()
  );
}

export function clearActiveTrip() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LOCAL_KEY);
}
