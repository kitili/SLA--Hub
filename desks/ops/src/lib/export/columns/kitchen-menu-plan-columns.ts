import type { CsvColumn } from "@/lib/export/csv-table";
import type { KitchenMenuPlanExportRow } from "@/lib/db/kitchen";

export const KITCHEN_MENU_PLAN_EXPORT_COLUMNS: CsvColumn<KitchenMenuPlanExportRow>[] = [
  { key: "id", header: "id" },
  { key: "school_name", header: "school_name" },
  { key: "serve_date", header: "serve_date" },
  { key: "meal_slot", header: "meal_slot" },
  { key: "menu_item_name", header: "menu_item_name" },
  { key: "notes", header: "notes" },
];
