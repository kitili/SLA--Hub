import { buildBusCompliance } from "@/lib/compliance/driver-compliance";
import { flagMaintenanceRecords } from "@/lib/compliance/maintenance-compliance";
import { getFacilitiesTopSheet } from "@/lib/db/facilities";
import { listRepeatedLowChecklistAlerts } from "@/lib/db/facilities";
import { getFarmPnL, listPlots } from "@/lib/db/farm";
import { getPeriodPnL } from "@/lib/db/finance";
import { getBusesWithCompliance } from "@/lib/db/drivers";
import {
  listKitchenBudgetsForYearToDate,
  listKitchenPurchasesForYearToDate,
} from "@/lib/db/kitchen";
import { listMaintenance } from "@/lib/db/maintenance";
import { getKitchenLeadershipKpis } from "@/lib/kitchen/kitchen-kpis";
import { getTransportCeoKpis } from "@/lib/dashboard/transport-ceo-kpis";
import type { Role } from "@/lib/roles";
import {
  departmentScopeLabel,
  overviewDepartmentsForRole,
  seesSafetyEscalations,
  type OverviewDepartmentId,
} from "@/lib/dashboard/overview-scopes";
import { createClient } from "@/lib/supabase/server";

/** Spend above budget by this fraction triggers a critical alert. */
export const BUDGET_OVERSHOOT_CRITICAL = 0.2;

export type AlertSeverity = "critical" | "warning";

export type OverviewAlert = {
  id: string;
  domain: OverviewDepartmentId | "safety" | "transport";
  severity: AlertSeverity;
  title: string;
  detail: string;
  href: string;
};

export type DomainMetric = {
  label: string;
  value: string;
  good: boolean | null;
};

export type DomainOverview = {
  id: OverviewDepartmentId | "transport";
  name: string;
  href: string;
  status: "ok" | "warning" | "critical";
  summary: string;
  metrics: DomainMetric[];
};

export type SuperAdminOverview = {
  generatedAt: string;
  monthLabel: string;
  scopeLabel: string;
  role: Role;
  alerts: OverviewAlert[];
  domains: DomainOverview[];
  counts: { critical: number; warning: number; healthy: number };
};

function monthBounds(d = new Date()) {
  const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });
  return { from, to, label };
}

function pct(n: number | null, digits = 0) {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

function money(n: number, currency = "TZS") {
  return `${currency} ${Math.round(n).toLocaleString()}`;
}

function worstStatus(alerts: OverviewAlert[], domain: OverviewAlert["domain"]) {
  const mine = alerts.filter((a) => a.domain === domain);
  if (mine.some((a) => a.severity === "critical")) return "critical" as const;
  if (mine.length > 0) return "warning" as const;
  return "ok" as const;
}

function budgetOvershootAlert(input: {
  domain: OverviewAlert["domain"];
  label: string;
  spent: number;
  budget: number;
  href: string;
  id: string;
}): OverviewAlert | null {
  if (input.budget <= 0) return null;
  const ratio = input.spent / input.budget;
  if (ratio < 1 + BUDGET_OVERSHOOT_CRITICAL) return null;
  const overPct = Math.round((ratio - 1) * 100);
  return {
    id: input.id,
    domain: input.domain,
    severity: "critical",
    title: `${input.label} over budget by ${overPct}%`,
    detail: `Spent ${money(input.spent)} against ${money(input.budget)} budget (${Math.round(ratio * 100)}% burn). Threshold is ${Math.round(BUDGET_OVERSHOOT_CRITICAL * 100)}% over plan.`,
    href: input.href,
  };
}

export async function getOpsCommandOverview(role: Role): Promise<SuperAdminOverview> {
  const allowed = new Set(overviewDepartmentsForRole(role));
  const needKitchen = allowed.has("kitchen");
  const needFacilities = allowed.has("facilities");
  const needFarm = allowed.has("farm");
  const needTransport = allowed.has("transport");
  const needSafety = seesSafetyEscalations(role);

  const today = new Date();
  const { from, to, label: monthLabel } = monthBounds(today);
  const ytdFrom = `${today.getFullYear()}-01-01`;
  const ytdTo = today.toISOString().slice(0, 10);
  const monthStart = from;

  const supabase = await createClient();

  const [
    kitchenKpis,
    kitchenBudgets,
    kitchenPurchases,
    facilities,
    farmYtd,
    farmMtd,
    plots,
    transportPnl,
    transportCeo,
    busesWithCompliance,
    maintenanceRecords,
    repeatedLowChecklistAlerts,
    farmAlertsRes,
    incidentAlertsRes,
  ] = await Promise.all([
    needKitchen ? getKitchenLeadershipKpis() : Promise.resolve({ kpis: [], error: undefined }),
    needKitchen
      ? listKitchenBudgetsForYearToDate(today.getFullYear(), monthStart)
      : Promise.resolve([]),
    needKitchen
      ? listKitchenPurchasesForYearToDate(today.getFullYear(), monthStart)
      : Promise.resolve([]),
    needFacilities ? getFacilitiesTopSheet() : Promise.resolve(null),
    needFarm ? getFarmPnL({ from: ytdFrom, to: ytdTo }) : Promise.resolve(null),
    needFarm ? getFarmPnL({ from, to }) : Promise.resolve(null),
    needFarm ? listPlots() : Promise.resolve([]),
    needTransport ? getPeriodPnL({ from, to }) : Promise.resolve(null),
    needTransport ? getTransportCeoKpis() : Promise.resolve({ kpis: [] }),
    needTransport ? getBusesWithCompliance() : Promise.resolve([]),
    needTransport ? listMaintenance() : Promise.resolve([]),
    needFacilities ? listRepeatedLowChecklistAlerts() : Promise.resolve([]),
    needFarm
      ? supabase
          .from("farm_alerts")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "notified"])
      : Promise.resolve({ count: 0, error: null }),
    needSafety
      ? supabase
          .from("incident_alerts")
          .select("id", { count: "exact", head: true })
          .is("acknowledged_at", null)
      : Promise.resolve({ count: 0, error: null }),
  ]);

  const alerts: OverviewAlert[] = [];

  const kitchenBudgetTotal = needKitchen
    ? kitchenBudgets.reduce((s, b) => s + Number(b.budget_amount), 0)
    : 0;
  const kitchenSpendTotal = needKitchen
    ? kitchenPurchases.reduce((s, p) => s + Number(p.total_cost), 0)
    : 0;

  if (needKitchen) {
    const kitchenBudgetAlert = budgetOvershootAlert({
      id: "kitchen-budget-ytd",
      domain: "kitchen",
      label: "Kitchen procurement YTD",
      spent: kitchenSpendTotal,
      budget: kitchenBudgetTotal,
      href: "/ops/kitchen",
    });
    if (kitchenBudgetAlert) alerts.push(kitchenBudgetAlert);

    for (const kpi of kitchenKpis.kpis) {
      if (kpi.good) continue;
      alerts.push({
        id: `kitchen-kpi-${kpi.label}`,
        domain: "kitchen",
        severity: "warning",
        title: `Kitchen: ${kpi.label} off target`,
        detail: `Actual ${kpi.actualDisplay} vs target ${kpi.targetDisplay}.`,
        href: "/ops/kitchen/dashboard",
      });
    }
  }

  if (needFacilities && facilities) {
    if (facilities.error) {
      alerts.push({
        id: "facilities-data",
        domain: "facilities",
        severity: "warning",
        title: "Facilities data unavailable",
        detail: facilities.error,
        href: "/ops/facilities",
      });
    } else {
      const checklistPct =
        facilities.checklistWalkthroughsTarget > 0
          ? facilities.checklistWalkthroughsDone / facilities.checklistWalkthroughsTarget
          : null;
      if (checklistPct !== null && checklistPct < 0.9) {
        alerts.push({
          id: "facilities-checklist",
          domain: "facilities",
          severity: "warning",
          title: "Facilities checklist walkthroughs behind",
          detail: `${facilities.checklistWalkthroughsDone} of ${facilities.checklistWalkthroughsTarget} completed this month.`,
          href: "/ops/facilities/checklist",
        });
      }
      if (facilities.outstandingTickets > 0) {
        alerts.push({
          id: "facilities-rm-open",
          domain: "facilities",
          severity:
            facilities.outstandingTickets >= 5 ||
            (facilities.avgOutstandingAgeDays ?? 0) > 21
              ? "critical"
              : "warning",
          title: `${facilities.outstandingTickets} open R&M ticket${facilities.outstandingTickets === 1 ? "" : "s"}`,
          detail:
            facilities.avgOutstandingAgeDays != null
              ? `Average age ${facilities.avgOutstandingAgeDays.toFixed(0)} days.`
              : "Review outstanding repairs on the Facilities Top Sheet.",
          href: "/ops/facilities/issues",
        });
      }
      if (
        facilities.generatorAvgScore !== null &&
        facilities.generatorAvgScore < 4.5
      ) {
        alerts.push({
          id: "facilities-generator",
          domain: "facilities",
          severity: "warning",
          title: "Generator checklist below target",
          detail: `Average score ${facilities.generatorAvgScore.toFixed(2)} / 5 (target 4.5).`,
          href: "/ops/facilities/generator",
        });
      }
        for (const lowAlert of repeatedLowChecklistAlerts.slice(0, 3)) {
          alerts.push({
            id: `facilities-low-checklist-${lowAlert.school_id ?? "none"}-${lowAlert.area}`,
            domain: "facilities",
            severity: "warning",
            title: `${lowAlert.school_name}: ${lowAlert.area} has ${lowAlert.streak} low scores`,
            detail: `Latest score ${lowAlert.latest_score}/5 on ${lowAlert.latest_date}.`,
            href: "/ops/facilities/checklist",
          });
        }
    }
  }

  if (needFarm && farmYtd) {
    for (const row of farmYtd.budget_burn) {
      if (row.burn_pct < 100 + BUDGET_OVERSHOOT_CRITICAL * 100) continue;
      alerts.push({
        id: `farm-budget-${row.category}-${row.period}`,
        domain: "farm",
        severity: "critical",
        title: `Farm ${row.category} budget ${row.burn_pct}% burned (YTD)`,
        detail: `Spent ${money(row.spent)} of ${money(row.planned_amount)} planned.`,
        href: "/admin/farm/expenses",
      });
    }
  }

  const farmAlertCount = farmAlertsRes.error ? 0 : (farmAlertsRes.count ?? 0);
  const incidentAlertCount = incidentAlertsRes.error
    ? 0
    : (incidentAlertsRes.count ?? 0);

  if (needFarm && farmAlertCount > 0) {
    alerts.push({
      id: "farm-alerts",
      domain: "farm",
      severity: "warning",
      title: `${farmAlertCount} farm alert${farmAlertCount === 1 ? "" : "s"} open`,
      detail: "Overdue tasks, budget overruns, or low stock need attention.",
      href: "/admin/farm",
    });
  }

  if (needTransport && transportPnl) {
    for (const row of transportPnl.budgets) {
      if (row.burn_pct < 100 + BUDGET_OVERSHOOT_CRITICAL * 100) continue;
      alerts.push({
        id: `transport-budget-${row.id}`,
        domain: "transport",
        severity: "critical",
        title: `Transport ${row.name} over budget (${row.burn_pct}%)`,
        detail: `Spent ${money(row.spent)} of ${money(row.budget_amount)}.`,
        href: "/admin/ledger",
      });
    }
  }

  const flaggedBuses = needTransport
    ? busesWithCompliance.filter(
        (b) => buildBusCompliance(b, b.driver).worst !== "ok",
      ).length
    : 0;
  const flaggedMaintenance = needTransport
    ? flagMaintenanceRecords(maintenanceRecords).length
    : 0;
  if (needTransport && flaggedBuses + flaggedMaintenance > 0) {
    alerts.push({
      id: "transport-compliance",
      domain: "transport",
      severity: flaggedBuses > 0 ? "critical" : "warning",
      title: "Fleet compliance needs attention",
      detail: `${flaggedBuses} bus${flaggedBuses === 1 ? "" : "es"} and ${flaggedMaintenance} maintenance flag${flaggedMaintenance === 1 ? "" : "s"}.`,
      href: "/admin/alerts",
    });
  }

  if (needSafety && incidentAlertCount > 0) {
    alerts.push({
      id: "incident-escalations",
      domain: "safety",
      severity: "critical",
      title: `${incidentAlertCount} unacknowledged incident escalation${incidentAlertCount === 1 ? "" : "s"}`,
      detail: "High-severity matron incidents waiting for admin review.",
      href: "/admin/alerts",
    });
  }

  if (needTransport) {
    for (const kpi of transportCeo.kpis) {
      if (kpi.good) continue;
      alerts.push({
        id: `transport-ceo-${kpi.label}`,
        domain: "transport",
        severity: "warning",
        title: `Transport CEO KPI off: ${kpi.label}`,
        detail: `Actual ${kpi.actualDisplay} vs target ${kpi.targetDisplay}.`,
        href: "/ops/admin",
      });
    }
  }

  const totalAcreage = needFarm ? plots.reduce((s, p) => s + p.acreage, 0) : 0;
  const activeAcreage = needFarm
    ? plots.filter((p) => p.status === "active").reduce((s, p) => s + p.acreage, 0)
    : 0;
  const farmUtil =
    totalAcreage > 0 ? Math.round((activeAcreage / totalAcreage) * 1000) / 10 : 0;

  const kitchenSavings =
    needKitchen && kitchenBudgetTotal > 0
      ? (kitchenBudgetTotal - kitchenSpendTotal) / kitchenBudgetTotal
      : null;

  const domains: DomainOverview[] = [];

  if (needKitchen) {
    domains.push({
      id: "kitchen",
      name: "Kitchen",
      href: "/ops/kitchen/dashboard",
      status: worstStatus(alerts, "kitchen"),
      summary: kitchenKpis.error ?? "Leadership KPIs and procurement vs budget.",
      metrics: [
        {
          label: "Daily checklist",
          value: kitchenKpis.kpis[0]?.actualDisplay ?? "—",
          good: kitchenKpis.kpis[0]?.good ?? null,
        },
        {
          label: "Budget savings YTD",
          value: pct(kitchenSavings),
          good: kitchenSavings === null ? null : kitchenSavings >= 0.1,
        },
        {
          label: "Spend vs budget YTD",
          value:
            kitchenBudgetTotal > 0
              ? `${Math.round((kitchenSpendTotal / kitchenBudgetTotal) * 100)}%`
              : "—",
          good:
            kitchenBudgetTotal > 0
              ? kitchenSpendTotal <= kitchenBudgetTotal * (1 + BUDGET_OVERSHOOT_CRITICAL)
              : null,
        },
      ],
    });
  }

  if (needFacilities && facilities) {
    domains.push({
      id: "facilities",
      name: "Facilities",
      href: "/ops/facilities",
      status: worstStatus(alerts, "facilities"),
      summary: `${facilities.campus} · ${facilities.monthLabel}`,
      metrics: [
        {
          label: "Checklist walkthroughs",
          value: `${facilities.checklistWalkthroughsDone}/${facilities.checklistWalkthroughsTarget}`,
          good:
            facilities.checklistWalkthroughsTarget > 0
              ? facilities.checklistWalkthroughsDone >=
                facilities.checklistWalkthroughsTarget * 0.9
              : null,
        },
        {
          label: "Open R&M tickets",
          value: String(facilities.outstandingTickets),
          good: facilities.outstandingTickets === 0,
        },
        {
          label: "Generator avg /5",
          value:
            facilities.generatorAvgScore === null
              ? "—"
              : facilities.generatorAvgScore.toFixed(2),
          good:
            facilities.generatorAvgScore === null
              ? null
              : facilities.generatorAvgScore >= 4.5,
        },
      ],
    });
  }

  if (needFarm && farmYtd && farmMtd) {
    domains.push({
      id: "farm",
      name: "Farm",
      href: "/admin/farm",
      status: worstStatus(alerts, "farm"),
      summary: "Usa River · plots, harvest value, and budget burn.",
      metrics: [
        {
          label: "Net savings YTD",
          value: money(farmYtd.net_savings),
          good: farmYtd.net_savings >= 0,
        },
        {
          label: "Plot utilisation",
          value: `${farmUtil}%`,
          good: farmUtil >= 70,
        },
        {
          label: "MTD net",
          value: money(farmMtd.net_savings),
          good: farmMtd.net_savings >= 0,
        },
      ],
    });
  }

  if (needTransport && transportPnl) {
    domains.push({
      id: "transport",
      name: "Transport",
      href: "/admin/dashboard",
      status: worstStatus(alerts, "transport"),
      summary: `${monthLabel} P&L, fleet compliance, CEO sheet KPIs.`,
      metrics: [
        {
          label: "Net (MTD)",
          value: money(transportPnl.net),
          good: transportPnl.net >= 0,
        },
        {
          label: "Compliance flags",
          value: String(flaggedBuses + flaggedMaintenance),
          good: flaggedBuses + flaggedMaintenance === 0,
        },
        {
          label: "CEO KPIs on target",
          value: `${transportCeo.kpis.filter((k) => k.good).length}/${transportCeo.kpis.length || "—"}`,
          good:
            transportCeo.kpis.length > 0
              ? transportCeo.kpis.every((k) => k.good)
              : null,
        },
      ],
    });
  }

  const critical = alerts.filter((a) => a.severity === "critical").length;
  const warning = alerts.filter((a) => a.severity === "warning").length;
  const healthy = domains.filter((d) => d.status === "ok").length;

  return {
    generatedAt: today.toISOString(),
    monthLabel,
    scopeLabel: departmentScopeLabel(role),
    role,
    alerts: alerts.sort((a, b) =>
      a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1,
    ),
    domains,
    counts: { critical, warning, healthy },
  };
}

/** @deprecated Use getOpsCommandOverview(role) */
export async function getSuperAdminOverview(): Promise<SuperAdminOverview> {
  return getOpsCommandOverview("admin");
}
