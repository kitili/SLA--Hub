/**
 * eat.ts — East Africa Time ("Feedback Hour") helper.
 *
 * Silverleaf Academy runs in Tanzania, so the daily "Feedback Hour" is anchored
 * to East Africa Time (EAT). EAT is `Africa/Dar_es_Salaam`: a fixed UTC+3 with
 * no daylight saving. We deliberately do NOT do `+3` arithmetic and we never
 * trust a client-supplied timezone — instead we project the server's instant
 * onto EAT wall-clock fields via `Intl.DateTimeFormat`, which is correct even
 * if the host/server timezone ever changes.
 *
 * Pure, deterministic logic: the `date` is injected (defaulting to `new Date()`)
 * so callers and unit tests can pin an exact instant.
 *
 * `server-only` is imported to keep this out of any Client Component bundle
 * (this is clock/locale logic that belongs on the server). The Vitest config
 * aliases `server-only` to an empty shim, so the import is a no-op under test.
 */
import "server-only";

/** IANA zone for East Africa Time (fixed UTC+3, no DST). */
const EAT_TIME_ZONE = "Africa/Dar_es_Salaam";

/**
 * The daily Feedback Hour window, expressed in EAT wall-clock hours.
 * Half-open interval `[startHour, endHour)` — i.e. 15:00 inclusive, 17:00
 * exclusive.
 */
export const FEEDBACK_WINDOW = { startHour: 15, endHour: 17 } as const;

/**
 * Formatter that yields the EAT calendar parts of any instant. `en-CA` gives
 * ISO-ordered `YYYY-MM-DD` date parts; `hourCycle: "h23"` keeps hours in the
 * 0–23 range (so midnight is `00`, not `24`).
 */
const eatParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: EAT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Pull a single named part out of `Intl.DateTimeFormat#formatToParts`. */
function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  const found = parts.find((p) => p.type === type);
  if (!found) {
    // Should never happen for the fields we requested above.
    throw new Error(`Missing "${type}" part from EAT formatter`);
  }
  return found.value;
}

/**
 * Project an instant onto EAT wall-clock fields.
 *
 * @param date Instant to convert. Defaults to the current moment.
 * @returns `hour` (0–23) and `minute` (0–59) in EAT, plus `dateKey`, the EAT
 *   calendar date as `YYYY-MM-DD`. `dateKey` is the *EAT* day, which can differ
 *   from the UTC day near midnight.
 */
export function eatNow(date: Date = new Date()): {
  hour: number;
  minute: number;
  dateKey: string;
} {
  const parts = eatParts.formatToParts(date);
  return {
    hour: Number(part(parts, "hour")),
    minute: Number(part(parts, "minute")),
    dateKey: `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}`,
  };
}

/**
 * Whether the given instant falls inside the EAT Feedback Hour window
 * `[15:00, 17:00)`.
 *
 * @param date Instant to test. Defaults to the current moment.
 */
export function isFeedbackHour(date: Date = new Date()): boolean {
  const { hour } = eatNow(date);
  return hour >= FEEDBACK_WINDOW.startHour && hour < FEEDBACK_WINDOW.endHour;
}
