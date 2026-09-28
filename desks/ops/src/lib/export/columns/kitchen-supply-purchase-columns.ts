import type { CsvColumn } from "@/lib/export/csv-table";
import type { KitchenSupplyPurchaseExportRow } from "@/lib/db/kitchen";

export const KITCHEN_SUPPLY_PURCHASE_EXPORT_COLUMNS: CsvColumn<KitchenSupplyPurchaseExportRow>[] = [
  { key: "id", header: "id" },
  { key: "school_name", header: "school_name" },
  { key: "month", header: "month" },
  { key: "supply_name", header: "supply_name" },
  { key: "quantity", header: "quantity" },
  { key: "unit_price", header: "unit_price" },
  { key: "total_cost", header: "total_cost" },
  { key: "purchased_on", header: "purchased_on" },
  { key: "notes", header: "notes" },
  { key: "created_at", header: "created_at" },
];
