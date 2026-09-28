import type { CsvColumn } from "@/lib/export/csv-table";
import type { KitchenSurveyResponse } from "@/lib/db/kitchen";

function formatYesNo(value: boolean | null): string {
  if (value === null) return "";
  return value ? "yes" : "no";
}

export const KITCHEN_SURVEY_RESPONSE_EXPORT_COLUMNS: CsvColumn<KitchenSurveyResponse>[] = [
  { key: "id", header: "id" },
  { key: "submitted_at", header: "submitted_at" },
  { key: "school_id", header: "school_id" },
  { key: "class_or_grade", header: "class_or_grade" },
  { key: "source", header: "source" },
  { key: "quality_rating", header: "quality_rating" },
  {
    key: "served_on_time",
    header: "served_on_time",
    format: (row) => formatYesNo(row.served_on_time),
  },
  {
    key: "sufficient_quantity",
    header: "sufficient_quantity",
    format: (row) => formatYesNo(row.sufficient_quantity),
  },
  { key: "consistency_rating", header: "consistency_rating" },
  { key: "satisfaction_level", header: "satisfaction_level" },
  { key: "comment_text", header: "comment_text" },
];
