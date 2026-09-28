import type { TripDirection } from "@/types/database";

/** Durable across tab closes (unlike matron sessionStorage). */
const KEY = "driver.activeTrip";

export type DriverActiveTrip = {
  tripId: string;
  busId: string;
  busLabel: string;
  direction: TripDirection;
  savedAt: string;
};

export function saveDriverTrip(trip: DriverActiveTrip) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(trip));
  window.dispatchEvent(new Event("driver-active-trip"));
}

export function loadDriverTrip(): DriverActiveTrip | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DriverActiveTrip;
    if (!parsed?.tripId || !parsed?.busId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDriverTrip() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("driver-active-trip"));
}
