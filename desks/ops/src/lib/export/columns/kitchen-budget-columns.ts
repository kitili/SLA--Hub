import type { CsvColumn } from "@/lib/export/csv-table";
import type { KitchenBudgetExportRow } from "@/lib/db/kitchen";

export const KITCHEN_BUDGET_EXPORT_COLUMNS: CsvColumn<KitchenBudgetExportRow>[] = [
  { key: "id", header: "id" },
  { key: "school_name", header: "school_name" },
  { key: "month", header: "month" },
  { key: "budget_amount", header: "budget_amount" },
  { key: "currency", header: "currency" },
];
