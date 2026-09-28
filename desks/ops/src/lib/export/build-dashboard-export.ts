import { CAMPUS_SHEET } from "@/lib/dashboard/campus-sheet";
import { getPeriodPnL } from "@/lib/db/finance";
import {
  listBoardingEventsForReport,
  getBuses,
  getSchools,
  getStudents,
} from "@/lib/db/queries";
import {
  DASHBOARD_SHEET_META,
  type DashboardSheetId,
} from "@/lib/export/dashboard-sheet-meta";
import type { SheetTab } from "@/lib/export/spreadsheet";

export type { DashboardSheetId };
export { DASHBOARD_SHEET_META };

function dayOffsetIso(daysBack: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

function eachDateInclusive(from: string, to: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function formatLocalTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function prettyCategory(key: string) {
  return key.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function buildDashboardExportTabs(options: {
  from: string;
  to: string;
  include?: DashboardSheetId[];
}): Promise<SheetTab[]> {
  const { from, to } = options;
  const include = new Set(
    options.include ?? DASHBOARD_SHEET_META.map((s) => s.id),
  );

  const trendDates = Array.from({ length: 7 }, (_, i) => dayOffsetIso(6 - i));
  const periodDates = eachDateInclusive(from, to);
  const scanDates = periodDates.length > 62 ? trendDates : periodDates;
  const scanNote =
    periodDates.length > 62
      ? `Boarding tabs use last 7 days (period spans ${periodDates.length} days; capped for speed).`
      : `Boarding tabs cover ${from} → ${to}.`;

  const [students, buses, schools, pnl, ...boardingChunks] = await Promise.all([
    getStudents(),
    getBuses(),
    getSchools(),
    getPeriodPnL({ from, to }),
    ...scanDates.map((date) => listBoardingEventsForReport({ from: date, to: date })),
  ]);

  const schoolBySlug = Object.fromEntries(schools.map((s) => [s.slug, s]));
  const capacityTotal = buses.reduce((s, b) => s + (b.capacity || 0), 0);
  const occupancyPct =
    capacityTotal > 0
      ? Math.round((students.length / capacityTotal) * 1000) / 10
      : 0;

  const boardingByDate = scanDates.map((date, i) => {
    const day = boardingChunks[i] ?? [];
    return {
      date,
      total: day.length,
      timeIn: day.filter((e) => e.event_type === "in").length,
      timeOut: day.filter((e) => e.event_type === "out").length,
      events: day,
    };
  });

  const budgetBurnAvg =
    pnl.budgets.length > 0
      ? Math.round(
          (pnl.budgets.reduce((s, b) => s + b.burn_pct, 0) /
            pnl.budgets.length) *
            10,
        ) / 10
      : null;

  const tabs: SheetTab[] = [];

  if (include.has("readme")) {
    tabs.push({
      name: "Read me",
      rows: [
        ["Silverleaf transport — dashboard export"],
        [],
        ["Period from", from],
        ["Period to", to],
        ["Generated at", formatLocalTime(new Date().toISOString())],
        ["Currency", pnl.currency],
        [],
        ["How to open in Google Sheets"],
        [
          "1",
          "Upload this .xlsx to Google Drive, then open with Google Sheets — each tab becomes a sheet.",
        ],
        [
          "2",
          "Or: File → Import → Upload in an empty Google Sheet (replace or insert new sheets).",
        ],
        [
          "3",
          "CSV pack: unzip, then File → Import each CSV as its own sheet.",
        ],
        [],
        ["Notes", scanNote],
        ["Tabs", DASHBOARD_SHEET_META.map((s) => s.name).join(", ")],
      ],
    });
  }

  if (include.has("summary")) {
    tabs.push({
      name: "Summary",
      rows: [
        ["Metric", "Value", "Unit / note"],
        ["Period from", from, "YYYY-MM-DD"],
        ["Period to", to, "YYYY-MM-DD"],
        ["Students in DB", students.length, "count"],
        ["Buses registered", buses.length, "count"],
        ["Seat capacity", capacityTotal, "seats"],
        ["Roster occupancy", occupancyPct, "%"],
        ["Period revenue", Math.round(pnl.total_revenue), pnl.currency],
        ["Period expense", Math.round(pnl.total_expense), pnl.currency],
        ["Period net", Math.round(pnl.net), pnl.currency],
        ["Hire-outs quoted", Math.round(pnl.hire_out_quoted), pnl.currency],
        ["Hire-outs in period", pnl.hire_outs_in_period, "count"],
        [
          "Budget burn average",
          budgetBurnAvg ?? "",
          budgetBurnAvg == null ? "no envelopes" : "%",
        ],
        ["Campuses", schools.length || CAMPUS_SHEET.length, "count"],
      ],
    });
  }

  if (include.has("campus")) {
    tabs.push({
      name: "Campus",
      rows: [
        [
          "Campus",
          "Sheet riders",
          "Sheet capacity",
          "Sheet occupancy %",
          "DB students",
          "DB buses",
        ],
        ...CAMPUS_SHEET.map((c) => {
          const school = schoolBySlug[c.slug];
          const dbStudents = school
            ? students.filter((s) => s.school_id === school.id).length
            : 0;
          const dbBuses = school
            ? buses.filter((b) => b.school_id === school.id).length
            : 0;
          const occ =
            c.capacitySheet > 0
              ? Math.round((c.studentsSheet / c.capacitySheet) * 1000) / 10
              : 0;
          return [
            c.name,
            c.studentsSheet,
            c.capacitySheet,
            occ,
            dbStudents,
            dbBuses,
          ];
        }),
      ],
    });
  }

  if (include.has("boarding_daily")) {
    tabs.push({
      name: "Boarding daily",
      rows: [
        ["Date", "Total scans", "Time-in", "Time-out"],
        ...boardingByDate.map((d) => [d.date, d.total, d.timeIn, d.timeOut]),
      ],
    });
  }

  if (include.has("boarding_events")) {
    tabs.push({
      name: "Boarding events",
      rows: [
        ["Date", "Scanned at", "Student", "Bus", "Direction", "Event"],
        ...boardingByDate.flatMap((d) =>
          d.events.map((e) => [
            d.date,
            formatLocalTime(e.scanned_at),
            e.student_name,
            e.bus_label,
            String(e.direction).toUpperCase(),
            e.event_type === "in" ? "time-in" : "time-out",
          ]),
        ),
      ],
    });
  }

  if (include.has("expenses")) {
    const rows = Object.entries(pnl.expense_by_category).sort(
      (a, b) => b[1] - a[1],
    );
    tabs.push({
      name: "Expenses",
      rows: [
        ["Category", "Amount", "Currency", "Share %"],
        ...rows.map(([cat, amount]) => [
          prettyCategory(cat),
          Math.round(amount),
          pnl.currency,
          pnl.total_expense > 0
            ? Math.round((amount / pnl.total_expense) * 1000) / 10
            : 0,
        ]),
        ["TOTAL", Math.round(pnl.total_expense), pnl.currency, 100],
      ],
    });
  }

  if (include.has("revenue")) {
    const rows = Object.entries(pnl.revenue_by_category).sort(
      (a, b) => b[1] - a[1],
    );
    tabs.push({
      name: "Revenue",
      rows: [
        ["Category", "Amount", "Currency", "Share %"],
        ...rows.map(([cat, amount]) => [
          prettyCategory(cat),
          Math.round(amount),
          pnl.currency,
          pnl.total_revenue > 0
            ? Math.round((amount / pnl.total_revenue) * 1000) / 10
            : 0,
        ]),
        ["TOTAL", Math.round(pnl.total_revenue), pnl.currency, 100],
      ],
    });
  }

  if (include.has("budgets")) {
    tabs.push({
      name: "Budgets",
      rows: [
        ["Envelope", "Budget", "Spent", "Remaining", "Burn %", "Currency"],
        ...pnl.budgets.map((b) => [
          b.name,
          Math.round(b.budget_amount),
          Math.round(b.spent),
          Math.round(b.budget_amount - b.spent),
          b.burn_pct,
          pnl.currency,
        ]),
      ],
    });
  }

  return tabs;
}
