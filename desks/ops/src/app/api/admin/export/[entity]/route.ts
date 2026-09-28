import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { buildCsvExport } from "@/lib/export/csv-table";
import { getBuses, getSchools, listBoardingEventsForReport } from "@/lib/db/queries";
import { getDrivers } from "@/lib/db/drivers";
import {
  getFacilitiesTopSheet,
  listChecklistScores,
  listIssues,
  listSops,
  type ChecklistScore,
} from "@/lib/db/facilities";
import { listMaintenance } from "@/lib/db/maintenance";
import { listAllRouteStopsForExport } from "@/lib/db/routes";
import { listBudgets, listExpenses, listRevenues } from "@/lib/db/finance";
import { listRevenueTargets } from "@/lib/db/revenue-targets";
import { EXPENSE_EXPORT_COLUMNS, type ExpenseExportRow } from "@/lib/export/columns/expense-columns";
import { REVENUE_EXPORT_COLUMNS, type RevenueExportRow } from "@/lib/export/columns/revenue-columns";
import { BUDGET_EXPORT_COLUMNS, type BudgetExportRow } from "@/lib/export/columns/budget-columns";
import {
  REVENUE_TARGET_EXPORT_COLUMNS,
  type RevenueTargetExportRow,
} from "@/lib/export/columns/revenue-target-columns";
import {
  FACILITIES_CHECKLIST_EXPORT_COLUMNS,
  type FacilitiesChecklistExportRow,
} from "@/lib/export/columns/facilities-checklist-columns";
import {
  FACILITIES_ISSUE_EXPORT_COLUMNS,
  type FacilitiesIssueExportRow,
} from "@/lib/export/columns/facilities-issue-columns";
import {
  FACILITIES_SOP_EXPORT_COLUMNS,
  type FacilitiesSopExportRow,
} from "@/lib/export/columns/facilities-sop-columns";
import {
  FACILITIES_TOP_SHEET_EXPORT_COLUMNS,
  type FacilitiesTopSheetExportRow,
} from "@/lib/export/columns/facilities-top-sheet-columns";
import { MAINTENANCE_EXPORT_COLUMNS } from "@/lib/export/columns/maintenance-columns";
import { BUS_EXPORT_COLUMNS, type BusExportRow } from "@/lib/export/columns/bus-columns";
import { DRIVER_EXPORT_COLUMNS } from "@/lib/export/columns/driver-columns";
import { ROUTE_STOP_EXPORT_COLUMNS } from "@/lib/export/columns/route-stop-columns";
import {
  INCIDENT_EXPORT_COLUMNS,
  type IncidentExportRow,
} from "@/lib/export/columns/incident-columns";
import type { IncidentSeverity, IncidentType } from "@/types/database";
import {
  listAllKitchenBudgetsForExport,
  listAllKitchenEquipmentForExport,
  listAllKitchenHeadcountLinesForExport,
  listAllKitchenMealAttendanceForExport,
  listAllKitchenMenuPlansForExport,
  listAllKitchenStaffMembersForExport,
  listAllKitchenSuppliesForExport,
  listAllKitchenSupplyPurchasesForExport,
  listAllKitchenWasteLogsForExport,
  listKitchenIngredients,
  listKitchenMenuItems,
  listKitchenSurveyResponses,
  listKitchenVendors,
  listRecentKitchenPurchases,
} from "@/lib/db/kitchen";
import { KITCHEN_BUDGET_EXPORT_COLUMNS } from "@/lib/export/columns/kitchen-budget-columns";
import { KITCHEN_EQUIPMENT_EXPORT_COLUMNS } from "@/lib/export/columns/kitchen-equipment-columns";
import { KITCHEN_HEADCOUNT_LINE_EXPORT_COLUMNS } from "@/lib/export/columns/kitchen-headcount-line-columns";
import { KITCHEN_INGREDIENT_EXPORT_COLUMNS } from "@/lib/export/columns/kitchen-ingredient-columns";
import { KITCHEN_MEAL_ATTENDANCE_EXPORT_COLUMNS } from "@/lib/export/columns/kitchen-meal-attendance-columns";
import { KITCHEN_MENU_ITEM_EXPORT_COLUMNS } from "@/lib/export/columns/kitchen-menu-item-columns";
import { KITCHEN_MENU_PLAN_EXPORT_COLUMNS } from "@/lib/export/columns/kitchen-menu-plan-columns";
import { KITCHEN_PURCHASE_EXPORT_COLUMNS } from "@/lib/export/columns/kitchen-purchase-columns";
import { KITCHEN_STAFF_EXPORT_COLUMNS } from "@/lib/export/columns/kitchen-staff-columns";
import { KITCHEN_SUPPLY_EXPORT_COLUMNS } from "@/lib/export/columns/kitchen-supply-columns";
import { KITCHEN_SUPPLY_PURCHASE_EXPORT_COLUMNS } from "@/lib/export/columns/kitchen-supply-purchase-columns";
import { KITCHEN_SURVEY_RESPONSE_EXPORT_COLUMNS } from "@/lib/export/columns/kitchen-survey-response-columns";
import { KITCHEN_VENDOR_EXPORT_COLUMNS } from "@/lib/export/columns/kitchen-vendor-columns";
import { KITCHEN_WASTE_LOG_EXPORT_COLUMNS } from "@/lib/export/columns/kitchen-waste-log-columns";
import { BOARDING_EVENT_EXPORT_COLUMNS } from "@/lib/export/columns/boarding-columns";

type Ctx = { params: Promise<{ entity: string }> };

const ENTITIES = [
  "buses",
  "drivers",
  "routes",
  "maintenance",
  "incidents",
  "boarding-events",
  "expenses",
  "revenues",
  "budgets",
  "revenue-targets",
  "facilities-top-sheet",
  "facilities-checklist",
  "facilities-issues",
  "facilities-sops",
  "kitchen-ingredients",
  "kitchen-equipment",
  "kitchen-staff",
  "kitchen-supplies",
  "kitchen-menu-items",
  "kitchen-vendors",
  "kitchen-purchases",
  "kitchen-supply-purchases",
  "kitchen-waste-logs",
  "kitchen-survey-responses",
  "kitchen-meal-attendance",
  "kitchen-headcount-lines",
  "kitchen-menu-plans",
  "kitchen-budgets",
] as const;
type Entity = (typeof ENTITIES)[number];

function isEntity(value: string): value is Entity {
  return (ENTITIES as readonly string[]).includes(value);
}

// Kitchen's bulk-export roles deliberately exclude cook/head_of_kitchens even
// though those roles can read individual Kitchen records normally -- least
// privilege for bulk data movement, matching KITCHEN_ROLES used by every
// Kitchen write route (see e.g. src/app/api/kitchen/ingredients/route.ts).
const KITCHEN_ROLES: Role[] = ["admin", "finance", "ops_manager", "finance_manager", "cfo"];
const FACILITIES_ROLES: Role[] = [
  "admin",
  "finance",
  "ops_manager",
  "finance_manager",
  "cfo",
];

// Per-entity access instead of one blanket check -- lets other domains
// register entities here with their own role set.
const ENTITY_ROLES: Record<Entity, Role[]> = {
  buses: ["admin", "transport"],
  drivers: ["admin", "transport"],
  routes: ["admin", "transport"],
  maintenance: ["admin", "transport"],
  incidents: ["admin", "transport"],
  // Least-privilege for bulk data movement, same reasoning as Kitchen's
  // roles above -- narrower than who can view the interactive report at
  // /admin/boarding itself (admin/finance/director/transport, per the
  // proxy's page-level gate in src/proxy.ts).
  "boarding-events": ["admin", "transport"],
  expenses: ["admin", "transport", "finance"],
  revenues: ["admin", "transport", "finance"],
  budgets: ["admin", "transport", "finance"],
  "revenue-targets": ["admin", "transport", "finance"],
  "facilities-top-sheet": FACILITIES_ROLES,
  "facilities-checklist": FACILITIES_ROLES,
  "facilities-issues": FACILITIES_ROLES,
  "facilities-sops": FACILITIES_ROLES,
  "kitchen-ingredients": KITCHEN_ROLES,
  "kitchen-equipment": KITCHEN_ROLES,
  "kitchen-staff": KITCHEN_ROLES,
  "kitchen-supplies": KITCHEN_ROLES,
  "kitchen-menu-items": KITCHEN_ROLES,
  "kitchen-vendors": KITCHEN_ROLES,
  "kitchen-purchases": KITCHEN_ROLES,
  "kitchen-supply-purchases": KITCHEN_ROLES,
  "kitchen-waste-logs": KITCHEN_ROLES,
  "kitchen-survey-responses": KITCHEN_ROLES,
  "kitchen-meal-attendance": KITCHEN_ROLES,
  "kitchen-headcount-lines": KITCHEN_ROLES,
  "kitchen-menu-plans": KITCHEN_ROLES,
  "kitchen-budgets": KITCHEN_ROLES,
};

async function buildCsv(entity: Entity): Promise<string> {
  switch (entity) {
    case "maintenance": {
      const rows = await listMaintenance();
      return buildCsvExport(rows, MAINTENANCE_EXPORT_COLUMNS);
    }
    case "facilities-top-sheet": {
      const sheet = await getFacilitiesTopSheet();
      const rows: FacilitiesTopSheetExportRow[] = [
        {
          month_key: sheet.monthKey,
          month_label: sheet.monthLabel,
          lead: sheet.lead,
          campus: sheet.campus,
          checklist_walkthroughs_done: sheet.checklistWalkthroughsDone,
          checklist_walkthroughs_target: sheet.checklistWalkthroughsTarget,
          checklist_avg_score: sheet.checklistAvgScore,
          checklist_avg_ratio: sheet.checklistAvgRatio,
          generator_days_checked: sheet.generatorDaysChecked,
          generator_avg_score: sheet.generatorAvgScore,
          outstanding_tickets: sheet.outstandingTickets,
          avg_outstanding_age_days: sheet.avgOutstandingAgeDays,
          avg_close_days: sheet.avgCloseDays,
          closed_tickets: sheet.closedTickets,
          total_issues: sheet.totalIssues,
          ytd_checklist_avg: sheet.ytdChecklistAvg,
          ytd_generator_avg: sheet.ytdGeneratorAvg,
          issues_count: sheet.counts.issues,
          checklist_count: sheet.counts.checklist,
          generator_count: sheet.counts.generator,
          houses_count: sheet.counts.houses,
          power_count: sheet.counts.power,
          cctv_count: sheet.counts.cctv,
          classrooms_count: sheet.counts.classrooms,
          sops_count: sheet.counts.sops,
          generated_at: new Date().toISOString(),
        },
      ];
      return buildCsvExport(rows, FACILITIES_TOP_SHEET_EXPORT_COLUMNS);
    }
    case "facilities-checklist": {
      const [scores, schools] = await Promise.all([listChecklistScores(), getSchools()]);
      const schoolById = new Map(schools.map((school) => [school.id, school]));
      const rows: FacilitiesChecklistExportRow[] = scores.map((score: ChecklistScore) => ({
        ...score,
        school_slug: schoolById.get(score.school_id ?? "")?.slug ?? "",
        school_name: schoolById.get(score.school_id ?? "")?.name ?? "",
      }));
      return buildCsvExport(rows, FACILITIES_CHECKLIST_EXPORT_COLUMNS);
    }
    case "facilities-issues": {
      const [issues, schools] = await Promise.all([listIssues(), getSchools()]);
      const schoolById = new Map(schools.map((school) => [school.id, school]));
      const rows: FacilitiesIssueExportRow[] = issues.map((issue) => ({
        ...issue,
        school_slug: schoolById.get(issue.school_id ?? "")?.slug ?? "",
        school_name: schoolById.get(issue.school_id ?? "")?.name ?? "",
      }));
      return buildCsvExport(rows, FACILITIES_ISSUE_EXPORT_COLUMNS);
    }
    case "facilities-sops": {
      const [sops, schools] = await Promise.all([listSops(), getSchools()]);
      const schoolById = new Map(schools.map((school) => [school.id, school]));
      const rows: FacilitiesSopExportRow[] = sops.map((sop) => ({
        ...sop,
        school_slug: schoolById.get(sop.school_id ?? "")?.slug ?? "",
        school_name: schoolById.get(sop.school_id ?? "")?.name ?? "",
      }));
      return buildCsvExport(rows, FACILITIES_SOP_EXPORT_COLUMNS);
    }
    case "drivers": {
      const rows = await getDrivers();
      return buildCsvExport(rows, DRIVER_EXPORT_COLUMNS);
    }
    case "buses": {
      const [buses, schools] = await Promise.all([getBuses(), getSchools()]);
      const schoolById = new Map(schools.map((s) => [s.id, s]));
      const rows: BusExportRow[] = buses.map((bus) => ({
        ...bus,
        school_slug: schoolById.get(bus.school_id)?.slug ?? "",
        school_name: schoolById.get(bus.school_id)?.name ?? "",
      }));
      return buildCsvExport(rows, BUS_EXPORT_COLUMNS);
    }
    case "routes": {
      const rows = await listAllRouteStopsForExport();
      return buildCsvExport(rows, ROUTE_STOP_EXPORT_COLUMNS);
    }
    case "incidents": {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("incidents")
        .select(
          "id, trip_id, reported_by, type, severity, notes, lat, lng, created_at, trips(bus_id, buses(school_id))",
        )
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error || !data) return buildCsvExport([], INCIDENT_EXPORT_COLUMNS);

      const rows: IncidentExportRow[] = data.map((row) => {
        const raw = row as unknown as {
          id: string;
          trip_id: string;
          reported_by: string | null;
          type: IncidentType;
          severity: IncidentSeverity;
          notes: string | null;
          lat: number | null;
          lng: number | null;
          created_at: string;
          trips?:
            | { bus_id: string; buses?: { school_id: string } | { school_id: string }[] | null }
            | { bus_id: string; buses?: { school_id: string } | { school_id: string }[] | null }[]
            | null;
        };
        const trip = Array.isArray(raw.trips) ? raw.trips[0] : raw.trips;
        const buses = trip?.buses;
        const bus = Array.isArray(buses) ? buses[0] : buses;
        return {
          id: raw.id,
          trip_id: raw.trip_id,
          reported_by: raw.reported_by,
          type: raw.type,
          severity: raw.severity,
          notes: raw.notes,
          lat: raw.lat,
          lng: raw.lng,
          created_at: raw.created_at,
          school_id: bus?.school_id ?? null,
        };
      });
      return buildCsvExport(rows, INCIDENT_EXPORT_COLUMNS);
    }
    case "boarding-events": {
      const rows = await listBoardingEventsForReport();
      return buildCsvExport(rows, BOARDING_EVENT_EXPORT_COLUMNS);
    }
    case "kitchen-ingredients": {
      const rows = await listKitchenIngredients();
      return buildCsvExport(rows, KITCHEN_INGREDIENT_EXPORT_COLUMNS);
    }
    case "kitchen-equipment": {
      const rows = await listAllKitchenEquipmentForExport();
      return buildCsvExport(rows, KITCHEN_EQUIPMENT_EXPORT_COLUMNS);
    }
    case "kitchen-staff": {
      const rows = await listAllKitchenStaffMembersForExport();
      return buildCsvExport(rows, KITCHEN_STAFF_EXPORT_COLUMNS);
    }
    case "kitchen-supplies": {
      const rows = await listAllKitchenSuppliesForExport();
      return buildCsvExport(rows, KITCHEN_SUPPLY_EXPORT_COLUMNS);
    }
    case "kitchen-menu-items": {
      const rows = await listKitchenMenuItems();
      return buildCsvExport(rows, KITCHEN_MENU_ITEM_EXPORT_COLUMNS);
    }
    case "kitchen-vendors": {
      const rows = await listKitchenVendors();
      return buildCsvExport(rows, KITCHEN_VENDOR_EXPORT_COLUMNS);
    }
    case "kitchen-purchases": {
      const rows = await listRecentKitchenPurchases(100000);
      return buildCsvExport(rows, KITCHEN_PURCHASE_EXPORT_COLUMNS);
    }
    case "kitchen-supply-purchases": {
      const rows = await listAllKitchenSupplyPurchasesForExport();
      return buildCsvExport(rows, KITCHEN_SUPPLY_PURCHASE_EXPORT_COLUMNS);
    }
    case "kitchen-waste-logs": {
      const rows = await listAllKitchenWasteLogsForExport();
      return buildCsvExport(rows, KITCHEN_WASTE_LOG_EXPORT_COLUMNS);
    }
    case "kitchen-survey-responses": {
      const rows = await listKitchenSurveyResponses({ limit: 100000 });
      return buildCsvExport(rows, KITCHEN_SURVEY_RESPONSE_EXPORT_COLUMNS);
    }
    case "kitchen-meal-attendance": {
      const rows = await listAllKitchenMealAttendanceForExport();
      return buildCsvExport(rows, KITCHEN_MEAL_ATTENDANCE_EXPORT_COLUMNS);
    }
    case "kitchen-headcount-lines": {
      const rows = await listAllKitchenHeadcountLinesForExport();
      return buildCsvExport(rows, KITCHEN_HEADCOUNT_LINE_EXPORT_COLUMNS);
    }
    case "kitchen-menu-plans": {
      const rows = await listAllKitchenMenuPlansForExport();
      return buildCsvExport(rows, KITCHEN_MENU_PLAN_EXPORT_COLUMNS);
    }
    case "kitchen-budgets": {
      const rows = await listAllKitchenBudgetsForExport();
      return buildCsvExport(rows, KITCHEN_BUDGET_EXPORT_COLUMNS);
    }
    case "expenses": {
      const [expenses, schools, buses] = await Promise.all([
        listExpenses(),
        getSchools(),
        getBuses(),
      ]);
      const schoolById = new Map(schools.map((s) => [s.id, s]));
      const busById = new Map(buses.map((b) => [b.id, b]));
      const rows: ExpenseExportRow[] = expenses.map((e) => ({
        ...e,
        school_name: (e.school_id && schoolById.get(e.school_id)?.name) ?? "",
        bus_label: (e.bus_id && busById.get(e.bus_id)?.label) ?? "",
      }));
      return buildCsvExport(rows, EXPENSE_EXPORT_COLUMNS);
    }
    case "revenues": {
      const [revenues, schools, buses] = await Promise.all([
        listRevenues(),
        getSchools(),
        getBuses(),
      ]);
      const schoolById = new Map(schools.map((s) => [s.id, s]));
      const busById = new Map(buses.map((b) => [b.id, b]));
      const rows: RevenueExportRow[] = revenues.map((r) => ({
        ...r,
        school_name: (r.school_id && schoolById.get(r.school_id)?.name) ?? "",
        bus_label: (r.bus_id && busById.get(r.bus_id)?.label) ?? "",
      }));
      return buildCsvExport(rows, REVENUE_EXPORT_COLUMNS);
    }
    case "budgets": {
      const [budgets, schools, buses] = await Promise.all([
        listBudgets(),
        getSchools(),
        getBuses(),
      ]);
      const schoolById = new Map(schools.map((s) => [s.id, s]));
      const busById = new Map(buses.map((b) => [b.id, b]));
      const rows: BudgetExportRow[] = budgets.map((b) => ({
        ...b,
        school_name: (b.school_id && schoolById.get(b.school_id)?.name) ?? "",
        bus_label: (b.bus_id && busById.get(b.bus_id)?.label) ?? "",
      }));
      return buildCsvExport(rows, BUDGET_EXPORT_COLUMNS);
    }
    case "revenue-targets": {
      const [targets, schools, buses] = await Promise.all([
        listRevenueTargets(),
        getSchools(),
        getBuses(),
      ]);
      const schoolById = new Map(schools.map((s) => [s.id, s]));
      const busById = new Map(buses.map((b) => [b.id, b]));
      const rows: RevenueTargetExportRow[] = targets.map((t) => ({
        ...t,
        school_name: (t.school_id && schoolById.get(t.school_id)?.name) ?? "",
        bus_label: (t.bus_id && busById.get(t.bus_id)?.label) ?? "",
      }));
      return buildCsvExport(rows, REVENUE_TARGET_EXPORT_COLUMNS);
    }
  }
}

/** GET /api/admin/export/:entity — CSV download, roles vary per entity (see ENTITY_ROLES). */
export async function GET(_request: Request, context: Ctx) {
  const { entity } = await context.params;
  if (!isEntity(entity)) {
    return NextResponse.json({ error: "Unknown export entity" }, { status: 400 });
  }

  const auth = await requireUser(ENTITY_ROLES[entity]);
  if ("response" in auth) return auth.response;

  const csv = await buildCsv(entity);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${entity}-${stamp}.csv"`,
    },
  });
}
