const SCHOOL_TIMEZONE = "Africa/Dar_es_Salaam";

/** Today's date as YYYY-MM-DD in the school's local timezone (not UTC). */
export function getSchoolToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHOOL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}
