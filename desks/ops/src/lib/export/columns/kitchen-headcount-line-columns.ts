import type { CsvColumn } from "@/lib/export/csv-table";
import type { KitchenHeadcountLineExportRow } from "@/lib/db/kitchen";

export const KITCHEN_HEADCOUNT_LINE_EXPORT_COLUMNS: CsvColumn<KitchenHeadcountLineExportRow>[] = [
  { key: "id", header: "id" },
  { key: "school_name", header: "school_name" },
  { key: "month", header: "month" },
  { key: "category", header: "category" },
  { key: "label", header: "label" },
  { key: "headcount", header: "headcount" },
  { key: "days_in_period", header: "days_in_period" },
  { key: "price_per_person", header: "price_per_person" },
];
