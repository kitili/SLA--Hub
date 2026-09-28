import type { CsvColumn } from "@/lib/export/csv-table";
import type { KitchenVendor } from "@/lib/db/kitchen";

export const KITCHEN_VENDOR_EXPORT_COLUMNS: CsvColumn<KitchenVendor>[] = [
  { key: "id", header: "id" },
  { key: "name", header: "name" },
  { key: "contact_person", header: "contact_person" },
  { key: "contact_phone", header: "contact_phone" },
  { key: "notes", header: "notes" },
  { key: "active", header: "active" },
];
