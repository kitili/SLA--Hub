import type { RevenueCategory } from "@/lib/db/finance";

/**
 * Does this revenue count toward this target's progress? Same scope
 * precedence as budgetMatchesExpense (bus, else campus, else fleet-wide),
 * but deliberately kept as its own function/file rather than reusing
 * budgetMatchesExpense -- a revenue target's "over 100%" means collected
 * more than expected (good), the opposite of a budget's "over 100%" means
 * overspent (bad). Keeping the two concepts structurally separate avoids
 * ever having to make a shared function direction-aware.
 */
export function revenueTargetMatchesRevenue(
  t: {
    category: RevenueCategory;
    school_id: string | null;
    bus_id: string | null;
    period_start: string;
    period_end: string;
  },
  r: {
    earned_on: string;
    category: RevenueCategory;
    school_id: string | null;
    bus_id?: string | null;
  },
): boolean {
  if (r.earned_on < t.period_start || r.earned_on > t.period_end) return false;
  if (r.category !== t.category) return false;
  if (t.bus_id) return r.bus_id === t.bus_id;
  if (t.school_id) return r.school_id === t.school_id;
  return true;
}
