import type { CsvColumn } from "@/lib/export/csv-table";
import type { KitchenIngredient } from "@/lib/db/kitchen";

export const KITCHEN_INGREDIENT_EXPORT_COLUMNS: CsvColumn<KitchenIngredient>[] = [
  { key: "id", header: "id" },
  { key: "name", header: "name" },
  { key: "unit", header: "unit" },
  { key: "category", header: "category" },
  { key: "calc_method", header: "calc_method" },
  { key: "people_per_kg", header: "people_per_kg" },
  { key: "kg_per_week", header: "kg_per_week" },
  { key: "default_unit_price", header: "default_unit_price" },
  { key: "active", header: "active" },
];
