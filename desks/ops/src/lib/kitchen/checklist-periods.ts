import type { KitchenChecklistCadence } from "@/lib/db/kitchen";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function mondayOfWeek(d: Date) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday;
}

function firstOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * The source sheet's own instructions: "Do this checklist daily -- enter the
 * numbers once a week, 1 to 5, based on the number of checks you entered
 * during the week." Daily's tracking columns are weekly-granular too, not
 * one-per-calendar-day -- so Daily and Weekly share the same period (the
 * current week), reflecting the week just gone.
 */
export function getCurrentChecklistPeriods(): Record<KitchenChecklistCadence, string> {
  const today = new Date();
  const weekStart = isoDate(mondayOfWeek(today));
  return {
    daily: weekStart,
    weekly: weekStart,
    monthly: isoDate(firstOfMonth(today)),
  };
}
