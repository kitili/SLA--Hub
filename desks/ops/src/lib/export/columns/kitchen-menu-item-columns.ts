import type { CsvColumn } from "@/lib/export/csv-table";
import type { KitchenMenuItem } from "@/lib/db/kitchen";

export const KITCHEN_MENU_ITEM_EXPORT_COLUMNS: CsvColumn<KitchenMenuItem>[] = [
  { key: "id", header: "id" },
  { key: "name", header: "name" },
  { key: "notes", header: "notes" },
  { key: "active", header: "active" },
];
