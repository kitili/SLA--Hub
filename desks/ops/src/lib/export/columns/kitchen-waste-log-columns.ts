import type { CsvColumn } from "@/lib/export/csv-table";
import type { KitchenWasteLogExportRow } from "@/lib/db/kitchen";

export const KITCHEN_WASTE_LOG_EXPORT_COLUMNS: CsvColumn<KitchenWasteLogExportRow>[] = [
  { key: "id", header: "id" },
  { key: "school_name", header: "school_name" },
  { key: "logged_on", header: "logged_on" },
  { key: "item_name", header: "item_name" },
  { key: "quantity", header: "quantity" },
  { key: "unit", header: "unit" },
  { key: "reason", header: "reason" },
  { key: "notes", header: "notes" },
];
