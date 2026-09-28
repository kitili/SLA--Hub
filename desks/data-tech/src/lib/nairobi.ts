// Nairobi is UTC+3 year-round (no DST). Calendar dates and the 09:30 deadline
// are always evaluated in this offset so a UTC cron cannot close a day early.

const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;

export type NairobiParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

export function nairobiParts(now = new Date()): NairobiParts {
  const shifted = new Date(now.getTime() + NAIROBI_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function nairobiDateString(now = new Date()) {
  const p = nairobiParts(now);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

export function nairobiDateFromParts(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function parseIsoDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

export function weekdayForDate(dateStr: string) {
  const parsed = parseIsoDate(dateStr);
  if (!parsed) return null;
  // Date.UTC noon avoids any offset pushing the weekday onto an adjacent day.
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12)).getUTCDay();
}

export function addDays(dateStr: string, days: number) {
  const parsed = parseIsoDate(dateStr);
  if (!parsed) return dateStr;
  const next = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days, 12));
  return nairobiDateFromParts(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

export function thursdayOfWeek(dateStr: string) {
  const weekday = weekdayForDate(dateStr);
  if (weekday === null) return dateStr;
  // Sunday = 0 … Thursday = 4. Walk back/forward to that week's Thursday.
  return addDays(dateStr, 4 - weekday);
}

// Pulse tracking uses the Thursday that has already started (or today if it is Thursday),
// not the upcoming one — Tue/Wed still look at last week's pulse so late filing works.
export function latestThursday(dateStr: string) {
  const weekday = weekdayForDate(dateStr);
  if (weekday === null) return dateStr;
  if (weekday >= 4) return addDays(dateStr, 4 - weekday);
  return addDays(dateStr, 4 - weekday - 7);
}

export function mondayOfWeek(dateStr: string) {
  const weekday = weekdayForDate(dateStr);
  if (weekday === null) return dateStr;
  const delta = weekday === 0 ? -6 : 1 - weekday;
  return addDays(dateStr, delta);
}

export function nairobiDeadline(dateStr: string, hour = 9, minute = 30) {
  return new Date(`${dateStr}T${pad2(hour)}:${pad2(minute)}:00+03:00`);
}

export function isBeforeDeadline(now: Date, dateStr: string, hour = 9, minute = 30) {
  return now.getTime() < nairobiDeadline(dateStr, hour, minute).getTime();
}

export function formatFriendlyDate(dateStr: string) {
  const parsed = parseIsoDate(dateStr);
  if (!parsed) return dateStr;
  const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
    weekdayForDate(dateStr) ?? 0
  ];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${weekday} ${parsed.day} ${months[parsed.month - 1]}`;
}
export const ONE_TO_FIVE_DEADLINE_HOUR = 9;
export const ONE_TO_FIVE_DEADLINE_MINUTE = 30;
export const PULSE_DEADLINE_HOUR = 9;
export const PULSE_DEADLINE_MINUTE = 30;
