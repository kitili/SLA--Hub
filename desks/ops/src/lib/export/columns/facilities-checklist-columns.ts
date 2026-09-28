import type { CsvColumn } from "@/lib/export/csv-table";
import type { ChecklistScore } from "@/lib/db/facilities";

export type FacilitiesChecklistExportRow = ChecklistScore & {
  school_slug: string;
  school_name: string;
};

export const FACILITIES_CHECKLIST_EXPORT_COLUMNS: CsvColumn<FacilitiesChecklistExportRow>[] = [
  { key: "id", header: "id" },
  { key: "school_slug", header: "school" },
  { key: "school_name", header: "school_name" },
  { key: "walkthrough_date", header: "walkthrough_date" },
  { key: "area", header: "area" },
  { key: "score", header: "score" },
  { key: "inspector", header: "inspector" },
  { key: "comments", header: "comments" },
  { key: "created_by", header: "created_by" },
  { key: "created_at", header: "created_at" },
];