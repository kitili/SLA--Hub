import type { CsvColumn } from "@/lib/export/csv-table";
import type { KitchenEquipmentExportRow } from "@/lib/db/kitchen";

export const KITCHEN_EQUIPMENT_EXPORT_COLUMNS: CsvColumn<KitchenEquipmentExportRow>[] = [
  { key: "id", header: "id" },
  { key: "school_name", header: "school_name" },
  { key: "name", header: "name" },
  { key: "category", header: "category" },
  { key: "quantity", header: "quantity" },
  { key: "condition", header: "condition" },
  { key: "purchased_on", header: "purchased_on" },
  { key: "replacement_cost", header: "replacement_cost" },
  { key: "notes", header: "notes" },
  { key: "active", header: "active" },
];
