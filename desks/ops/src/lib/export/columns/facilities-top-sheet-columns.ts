import type { CsvColumn } from "@/lib/export/csv-table";

export type FacilitiesTopSheetExportRow = {
  month_key: string;
  month_label: string;
  lead: string;
  campus: string;
  checklist_walkthroughs_done: number;
  checklist_walkthroughs_target: number;
  checklist_avg_score: number | null;
  checklist_avg_ratio: number | null;
  generator_days_checked: number;
  generator_avg_score: number | null;
  outstanding_tickets: number;
  avg_outstanding_age_days: number | null;
  avg_close_days: number | null;
  closed_tickets: number;
  total_issues: number;
  ytd_checklist_avg: number | null;
  ytd_generator_avg: number | null;
  issues_count: number;
  checklist_count: number;
  generator_count: number;
  houses_count: number;
  power_count: number;
  cctv_count: number;
  classrooms_count: number;
  sops_count: number;
  generated_at: string;
};

export const FACILITIES_TOP_SHEET_EXPORT_COLUMNS: CsvColumn<FacilitiesTopSheetExportRow>[] = [
  { key: "month_key", header: "month_key" },
  { key: "month_label", header: "month_label" },
  { key: "lead", header: "lead" },
  { key: "campus", header: "campus" },
  { key: "checklist_walkthroughs_done", header: "checklist_walkthroughs_done" },
  { key: "checklist_walkthroughs_target", header: "checklist_walkthroughs_target" },
  { key: "checklist_avg_score", header: "checklist_avg_score" },
  { key: "checklist_avg_ratio", header: "checklist_avg_ratio" },
  { key: "generator_days_checked", header: "generator_days_checked" },
  { key: "generator_avg_score", header: "generator_avg_score" },
  { key: "outstanding_tickets", header: "outstanding_tickets" },
  { key: "avg_outstanding_age_days", header: "avg_outstanding_age_days" },
  { key: "avg_close_days", header: "avg_close_days" },
  { key: "closed_tickets", header: "closed_tickets" },
  { key: "total_issues", header: "total_issues" },
  { key: "ytd_checklist_avg", header: "ytd_checklist_avg" },
  { key: "ytd_generator_avg", header: "ytd_generator_avg" },
  { key: "issues_count", header: "issues_count" },
  { key: "checklist_count", header: "checklist_count" },
  { key: "generator_count", header: "generator_count" },
  { key: "houses_count", header: "houses_count" },
  { key: "power_count", header: "power_count" },
  { key: "cctv_count", header: "cctv_count" },
  { key: "classrooms_count", header: "classrooms_count" },
  { key: "sops_count", header: "sops_count" },
  { key: "generated_at", header: "generated_at" },
];