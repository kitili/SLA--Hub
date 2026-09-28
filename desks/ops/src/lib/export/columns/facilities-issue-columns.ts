import type { CsvColumn } from "@/lib/export/csv-table";
import type { FacilitiesIssue } from "@/lib/db/facilities";

export type FacilitiesIssueExportRow = FacilitiesIssue & {
  school_slug: string;
  school_name: string;
};

export const FACILITIES_ISSUE_EXPORT_COLUMNS: CsvColumn<FacilitiesIssueExportRow>[] = [
  { key: "id", header: "id" },
  { key: "school_slug", header: "school" },
  { key: "school_name", header: "school_name" },
  { key: "report_date", header: "report_date" },
  { key: "description", header: "description" },
  { key: "status", header: "status" },
  { key: "reported_by", header: "reported_by" },
  { key: "accountable", header: "accountable" },
  { key: "responsible", header: "responsible" },
  { key: "deadline", header: "deadline" },
  { key: "resolved_date", header: "resolved_date" },
  { key: "next_steps", header: "next_steps" },
  { key: "notes", header: "notes" },
  { key: "cost", header: "cost" },
  { key: "expense_id", header: "expense_id" },
  { key: "created_by", header: "created_by" },
  { key: "created_at", header: "created_at" },
  { key: "updated_by", header: "updated_by" },
  { key: "updated_at", header: "updated_at" },
];