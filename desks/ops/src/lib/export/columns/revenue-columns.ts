import type { CsvColumn } from "@/lib/export/csv-table";
import type { Revenue } from "@/lib/db/finance";

export type RevenueExportRow = Revenue & {
  school_name: string;
  bus_label: string;
};

export const REVENUE_EXPORT_COLUMNS: CsvColumn<RevenueExportRow>[] = [
  { key: "id", header: "id" },
  { key: "school_name", header: "school_name" },
  { key: "bus_label", header: "bus_label" },
  { key: "category", header: "category" },
  { key: "title", header: "title" },
  { key: "amount", header: "amount" },
  { key: "currency", header: "currency" },
  { key: "earned_on", header: "earned_on" },
  { key: "notes", header: "notes" },
  { key: "created_at", header: "created_at" },
];
