import type { CsvColumn } from "@/lib/export/csv-table";
import type { Budget } from "@/lib/db/finance";

export type BudgetExportRow = Budget & {
  school_name: string;
  bus_label: string;
};

export const BUDGET_EXPORT_COLUMNS: CsvColumn<BudgetExportRow>[] = [
  { key: "id", header: "id" },
  { key: "name", header: "name" },
  { key: "school_name", header: "school_name" },
  { key: "bus_label", header: "bus_label" },
  { key: "category", header: "category" },
  { key: "period_start", header: "period_start" },
  { key: "period_end", header: "period_end" },
  { key: "amount", header: "amount" },
  { key: "currency", header: "currency" },
  { key: "notes", header: "notes" },
  { key: "created_at", header: "created_at" },
];
