import type { CsvColumn } from "@/lib/export/csv-table";
import type { KitchenSupply } from "@/lib/db/kitchen";

export const KITCHEN_SUPPLY_EXPORT_COLUMNS: CsvColumn<KitchenSupply>[] = [
  { key: "id", header: "id" },
  { key: "name", header: "name" },
  { key: "unit", header: "unit" },
  { key: "default_unit_price", header: "default_unit_price" },
  { key: "active", header: "active" },
];
