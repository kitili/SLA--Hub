import type {
  KitchenChecklistCadence,
  KitchenChecklistEntry,
  KitchenChecklistTemplate,
} from "@/lib/db/kitchen";

export const CHECKLIST_TARGET_PCT = 0.9;

/** Daily entries are a raw 1-5 self-score, averaged then normalized to a
 * 0-1 fraction. Weekly/monthly entries are already a 0/1 boolean-per-item
 * value, so their average IS the fraction directly -- this mirrors the two
 * genuinely different formulas found in the real sheet (Daily divides by 5,
 * Weekly/Monthly don't), not one shared rule scaled down. */
export function checklistPeriodScorePct(
  cadence: KitchenChecklistCadence,
  entries: KitchenChecklistEntry[],
): number | null {
  if (entries.length === 0) return null;
  const avg = entries.reduce((sum, e) => sum + e.score_value, 0) / entries.length;
  return cadence === "daily" ? avg / 5 : avg;
}

export type ChecklistCompleteness = {
  scoredCount: number;
  totalItems: number;
  scorePct: number | null;
};

export function checklistCompleteness(
  cadence: KitchenChecklistCadence,
  templates: KitchenChecklistTemplate[],
  entries: KitchenChecklistEntry[],
): ChecklistCompleteness {
  const relevant = templates.filter((t) => t.cadence === cadence);
  const entriesForTemplates = entries.filter((e) =>
    relevant.some((t) => t.id === e.template_id),
  );
  return {
    scoredCount: entriesForTemplates.length,
    totalItems: relevant.length,
    scorePct: checklistPeriodScorePct(cadence, entriesForTemplates),
  };
}
