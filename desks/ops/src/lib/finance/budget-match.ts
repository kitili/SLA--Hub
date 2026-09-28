import type { BudgetCategory, ExpenseCategory } from "@/lib/db/finance";

/**
 * Does this expense count against this budget's spend? Scope is matched
 * most-specific-first: a bus-scoped budget only counts that bus's own
 * expenses; a campus-scoped budget (no bus_id) only counts that campus's own
 * expenses; a fleet-wide budget (neither set) counts everything. The same
 * expense can legitimately count toward more than one applicable budget at
 * different scopes (e.g. a bus's own R&M budget AND a broader campus R&M
 * budget) -- that's expected, not double-counting, since nothing sums
 * budgets' `spent` figures into one grand total.
 *
 * Single source of truth for this rule -- both getPeriodPnL (server, in
 * src/lib/db/finance.ts) and the Ledger UI's pre-submit budget warning
 * (client, in LedgerClient.tsx) call this instead of each keeping their own
 * copy, after those two were found to have quietly drifted apart (the
 * client checked school_id, the server didn't check it at all). Kept in its
 * own dependency-free file (not finance.ts) specifically so the client
 * component can import it without pulling in finance.ts's server-only
 * `@/lib/supabase/server` import.
 */
export function budgetMatchesExpense(
  b: {
    category: BudgetCategory;
    school_id: string | null;
    bus_id: string | null;
    period_start: string;
    period_end: string;
  },
  e: {
    spent_on: string;
    category: ExpenseCategory;
    school_id: string | null;
    bus_id?: string | null;
  },
): boolean {
  if (e.spent_on < b.period_start || e.spent_on > b.period_end) return false;
  if (b.category !== "ops" && e.category !== b.category) return false;
  if (b.bus_id) return e.bus_id === b.bus_id;
  if (b.school_id) return e.school_id === b.school_id;
  return true;
}
