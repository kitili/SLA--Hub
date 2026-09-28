export const DASHBOARD_SHEET_META = [
  { id: "readme", name: "Read me", description: "How to open in Google Sheets" },
  { id: "summary", name: "Summary", description: "KPI snapshot for the period" },
  { id: "campus", name: "Campus", description: "Occupancy by campus" },
  { id: "boarding_daily", name: "Boarding daily", description: "Scans per day" },
  {
    id: "boarding_events",
    name: "Boarding events",
    description: "Every time-in / time-out row",
  },
  { id: "expenses", name: "Expenses", description: "Spend by category" },
  { id: "revenue", name: "Revenue", description: "Income by category" },
  { id: "budgets", name: "Budgets", description: "Envelope burn" },
] as const;

export type DashboardSheetId = (typeof DASHBOARD_SHEET_META)[number]["id"];
