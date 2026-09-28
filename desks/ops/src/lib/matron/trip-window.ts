/** Dar es Salaam — when matrons run AM vs PM on the bus. */
export const MATRON_TZ = "Africa/Dar_es_Salaam";

/** Hour 0–23 in school timezone. */
export function schoolLocalHour(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MATRON_TZ,
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  return Number(parts.find((p) => p.type === "hour")?.value ?? 12);
}

/** Default trip matrons should start now (before 13:00 → AM, else PM). */
export function primaryDirectionNow(now = new Date()): "am" | "pm" {
  return schoolLocalHour(now) < 13 ? "am" : "pm";
}

export function canStartTripDirection(
  direction: "am" | "pm",
  opts: {
    /** Active trip on this bus today, if any. */
    activeDirection?: "am" | "pm" | null;
    now?: Date;
  } = {},
): { ok: boolean; reason?: string } {
  const { activeDirection = null, now = new Date() } = opts;
  if (activeDirection) {
    if (activeDirection === direction) {
      return { ok: true };
    }
    return {
      ok: false,
      reason: `Finish the open ${activeDirection.toUpperCase()} trip before starting ${direction.toUpperCase()}.`,
    };
  }
  const slot = primaryDirectionNow(now);
  if (slot !== direction) {
    return {
      ok: false,
      reason:
        direction === "am"
          ? "Morning trips open before 1:00 PM (Dar time)."
          : "Afternoon trips open from 1:00 PM (Dar time).",
    };
  }
  return { ok: true };
}
