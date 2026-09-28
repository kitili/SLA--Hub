import type { CsvColumn } from "@/lib/export/csv-table";
import type { Expense } from "@/lib/db/finance";

export type ExpenseExportRow = Expense & {
  school_name: string;
  bus_label: string;
};

export const EXPENSE_EXPORT_COLUMNS: CsvColumn<ExpenseExportRow>[] = [
  { key: "id", header: "id" },
  { key: "school_name", header: "school_name" },
  { key: "bus_label", header: "bus_label" },
  { key: "category", header: "category" },
  { key: "title", header: "title" },
  { key: "amount", header: "amount" },
  { key: "currency", header: "currency" },
  { key: "spent_on", header: "spent_on" },
  { key: "notes", header: "notes" },
  { key: "created_at", header: "created_at" },
];
