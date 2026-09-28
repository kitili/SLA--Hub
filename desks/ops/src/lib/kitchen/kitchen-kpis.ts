// Leadership KPI rollup — the intended replacement for the "Kitchens Top
// Sheet" tab, computed live from our own tables instead of the broken
// cross-tab formulas the audit found there (KPI-1 read the wrong tab
// entirely, KPI-2 was frozen on January forever, KPI-3 compared a budget
// cell against itself). Same 3 KPIs, same 90%/90%/10% targets, real numbers.
import { getSchools } from "@/lib/db/queries";
import {
  getKitchenBudget,
  listKitchenBudgetsForYearToDate,
  listKitchenChecklistEntriesForSchools,
  listKitchenChecklistTemplates,
  listKitchenHeadcountLines,
  listKitchenPurchases,
  listKitchenPurchasesForYearToDate,
} from "@/lib/db/kitchen";
import { CHECKLIST_TARGET_PCT, checklistPeriodScorePct } from "@/lib/kitchen/checklist-score";

// The imported 2026 master-sheet data is richest for May 2026 across all 5
// campuses (headcount + purchases) -- same convention KitchenClient itself
// already uses for its own default month, so the Top Sheet's per-campus
// numbers actually match what Procurement shows for the same campus/month,
// rather than using "this calendar month" and looking emptier than reality.
const CAMPUS_SUMMARY_MONTH = "2026-05-01";

export type KitchenKpi = {
  label: string;
  targetDisplay: string;
  actualDisplay: string;
  good: boolean;
};

export type KitchenKpiResult = { kpis: KitchenKpi[]; error?: string };

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

export async function getKitchenLeadershipKpis(): Promise<KitchenKpiResult> {
  const schools = await getSchools();
  const schoolIds = schools.map((s) => s.id);
  if (schoolIds.length === 0) {
    return { kpis: [], error: "No campuses found" };
  }

  const today = new Date();
  const weekStart = isoDate(mondayOfWeek(today));
  const monthStart = isoDate(firstOfMonth(today));
  const year = today.getFullYear();

  const [dailyTemplates, weeklyTemplates, monthlyTemplates, entries, budgets, purchases] =
    await Promise.all([
      listKitchenChecklistTemplates("daily"),
      listKitchenChecklistTemplates("weekly"),
      listKitchenChecklistTemplates("monthly"),
      listKitchenChecklistEntriesForSchools(schoolIds, [weekStart, monthStart]),
      listKitchenBudgetsForYearToDate(year, monthStart),
      listKitchenPurchasesForYearToDate(year, monthStart),
    ]);

  const dailyIds = new Set(dailyTemplates.map((t) => t.id));
  const weeklyIds = new Set(weeklyTemplates.map((t) => t.id));
  const monthlyIds = new Set(monthlyTemplates.map((t) => t.id));

  const dailyEntries = entries.filter((e) => dailyIds.has(e.template_id));
  const weeklyEntries = entries.filter((e) => weeklyIds.has(e.template_id));
  const monthlyEntries = entries.filter((e) => monthlyIds.has(e.template_id));

  const dailyPct = checklistPeriodScorePct("daily", dailyEntries);
  const weeklyPct = checklistPeriodScorePct("weekly", weeklyEntries);
  const monthlyPct = checklistPeriodScorePct("monthly", monthlyEntries);
  const weeklyMonthlyPct =
    weeklyPct !== null && monthlyPct !== null
      ? (weeklyPct + monthlyPct) / 2
      : weeklyPct ?? monthlyPct;

  const totalBudget = budgets.reduce((sum, b) => sum + Number(b.budget_amount), 0);
  const totalSpend = purchases.reduce((sum, p) => sum + Number(p.total_cost), 0);
  const savingsPct = totalBudget > 0 ? (totalBudget - totalSpend) / totalBudget : null;

  const pctDisplay = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

  const kpis: KitchenKpi[] = [
    {
      label: "Daily Kitchens Checklist Performance",
      targetDisplay: `${Math.round(CHECKLIST_TARGET_PCT * 100)}%`,
      actualDisplay: pctDisplay(dailyPct),
      good: dailyPct !== null && dailyPct >= CHECKLIST_TARGET_PCT,
    },
    {
      label: "Weekly & Monthly Checklist Performance",
      targetDisplay: `${Math.round(CHECKLIST_TARGET_PCT * 100)}%`,
      actualDisplay: pctDisplay(weeklyMonthlyPct),
      good: weeklyMonthlyPct !== null && weeklyMonthlyPct >= CHECKLIST_TARGET_PCT,
    },
    {
      label: "Budget Savings (% of Total Budget YTD)",
      targetDisplay: "10%",
      actualDisplay: pctDisplay(savingsPct),
      good: savingsPct !== null && savingsPct >= 0.1,
    },
  ];

  return { kpis };
}

export type KitchenCampusSummary = {
  schoolId: string;
  schoolName: string;
  month: string;
  /** null = no headcount logged for this campus/month yet, not a real zero. */
  personDays: number | null;
  /** null = no purchases logged for this campus/month yet, not a real zero. */
  purchasesTotal: number | null;
  purchasesCount: number;
  /** null = budget never set for this campus/month. */
  budgetAmount: number | null;
  /** Actual spend ÷ person-days -- null unless both figures are real (not
   * computed from a fabricated headcount or a zero that isn't really zero). */
  costPerPersonDay: number | null;
  dailyPct: number | null;
  weeklyMonthlyPct: number | null;
};

/** Per-campus rollup for the Top Sheet — derived live from schools, so every
 * campus that exists gets a row, including any added after today. Every one
 * row; any figure with no real data yet stays null so the UI can show an
 * honest placeholder instead of a fabricated zero. */
export async function getKitchenCampusSummaries(): Promise<KitchenCampusSummary[]> {
  const schools = await getSchools();
  if (schools.length === 0) return [];

  const today = new Date();
  const weekStart = isoDate(mondayOfWeek(today));
  const monthStart = isoDate(firstOfMonth(today));

  const [dailyTemplates, weeklyTemplates, monthlyTemplates, entries] = await Promise.all([
    listKitchenChecklistTemplates("daily"),
    listKitchenChecklistTemplates("weekly"),
    listKitchenChecklistTemplates("monthly"),
    listKitchenChecklistEntriesForSchools(
      schools.map((s) => s.id),
      [weekStart, monthStart],
    ),
  ]);
  const dailyIds = new Set(dailyTemplates.map((t) => t.id));
  const weeklyIds = new Set(weeklyTemplates.map((t) => t.id));
  const monthlyIds = new Set(monthlyTemplates.map((t) => t.id));

  return Promise.all(
    schools.map(async (school): Promise<KitchenCampusSummary> => {
      const [headcountLines, purchases, budget] = await Promise.all([
        listKitchenHeadcountLines(school.id, CAMPUS_SUMMARY_MONTH),
        listKitchenPurchases(school.id, CAMPUS_SUMMARY_MONTH),
        getKitchenBudget(school.id, CAMPUS_SUMMARY_MONTH),
      ]);

      const personDays =
        headcountLines.length > 0
          ? headcountLines.reduce((sum, l) => sum + l.headcount * l.days_in_period, 0)
          : null;
      const purchasesTotal =
        purchases.length > 0
          ? purchases.reduce((sum, p) => sum + Number(p.total_cost), 0)
          : null;

      const schoolEntries = entries.filter((e) => e.school_id === school.id);
      const dailyPct = checklistPeriodScorePct(
        "daily",
        schoolEntries.filter((e) => dailyIds.has(e.template_id)),
      );
      const weeklyPct = checklistPeriodScorePct(
        "weekly",
        schoolEntries.filter((e) => weeklyIds.has(e.template_id)),
      );
      const monthlyPct = checklistPeriodScorePct(
        "monthly",
        schoolEntries.filter((e) => monthlyIds.has(e.template_id)),
      );
      const weeklyMonthlyPct =
        weeklyPct !== null && monthlyPct !== null
          ? (weeklyPct + monthlyPct) / 2
          : weeklyPct ?? monthlyPct;

      const costPerPersonDay =
        personDays && personDays > 0 && purchasesTotal !== null
          ? purchasesTotal / personDays
          : null;

      return {
        schoolId: school.id,
        schoolName: school.name,
        month: CAMPUS_SUMMARY_MONTH,
        personDays,
        purchasesTotal,
        purchasesCount: purchases.length,
        budgetAmount: budget ? Number(budget.budget_amount) : null,
        costPerPersonDay,
        dailyPct,
        weeklyMonthlyPct,
      };
    }),
  );
}
