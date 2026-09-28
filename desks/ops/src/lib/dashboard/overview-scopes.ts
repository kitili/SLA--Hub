import type { Role } from "@/lib/roles";

/** Live-sheet departments with KPI rollups — not the ticketing desk. */
export type OverviewDepartmentId = "kitchen" | "facilities" | "farm" | "transport";

const ALL_DEPARTMENTS: OverviewDepartmentId[] = [
  "kitchen",
  "facilities",
  "farm",
  "transport",
];

/** Which department KPIs each role may see on /ops/admin. */
export function overviewDepartmentsForRole(role: Role): OverviewDepartmentId[] {
  switch (role) {
    case "admin":
    case "finance":
      return ALL_DEPARTMENTS;
    case "ops_manager":
      return ["kitchen", "facilities", "farm"];
    case "finance_manager":
    case "cfo":
      return ["kitchen", "facilities"];
    default:
      return [];
  }
}

export function canAccessOpsCommandCenter(role: Role): boolean {
  return overviewDepartmentsForRole(role).length > 0;
}

export function seesSafetyEscalations(role: Role): boolean {
  return role === "admin" || role === "finance" || role === "transport";
}

export function commandCenterHeading(role: Role): {
  eyebrow: string;
  title: string;
  blurb: string;
} {
  switch (role) {
    case "admin":
      return {
        eyebrow: "Silverleaf leadership",
        title: "Ops overview",
        blurb:
          "Every live department at a glance — Kitchen, Facilities, Farm, and Transport. Alerts fire when KPIs or budgets are materially off plan (including spend above 20% of budget). Ticketing stays on the desk, not here.",
      };
    case "finance":
      return {
        eyebrow: "Finance oversight",
        title: "Department KPIs",
        blurb:
          "Cross-department budget and performance rollups for Kitchen, Facilities, Farm, and Transport.",
      };
    case "ops_manager":
      return {
        eyebrow: "Ops lead",
        title: "Your department KPIs",
        blurb:
          "Kitchen, Facilities, and Farm only — the sheets your team owns. Transport and ticketing are separate workspaces.",
      };
    case "finance_manager":
    case "cfo":
      return {
        eyebrow: role === "cfo" ? "CFO" : "Finance manager",
        title: "Kitchen & Facilities KPIs",
        blurb:
          "Procurement, compliance, and facilities performance — not farm, transport, or the ticket desk.",
      };
    default:
      return {
        eyebrow: "Ops",
        title: "Dashboard",
        blurb: "",
      };
  }
}

export function departmentScopeLabel(role: Role): string {
  const depts = overviewDepartmentsForRole(role);
  if (depts.length === ALL_DEPARTMENTS.length) return "All departments";
  return depts
    .map((d) => {
      switch (d) {
        case "kitchen":
          return "Kitchen & nutrition";
        case "facilities":
          return "Facilities";
        case "farm":
          return "Farm";
        case "transport":
          return "Transport";
      }
    })
    .join(" · ");
}
