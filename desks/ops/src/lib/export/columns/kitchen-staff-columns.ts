import type { CsvColumn } from "@/lib/export/csv-table";
import type { KitchenStaffMemberExportRow } from "@/lib/db/kitchen";

export const KITCHEN_STAFF_EXPORT_COLUMNS: CsvColumn<KitchenStaffMemberExportRow>[] = [
  { key: "id", header: "id" },
  { key: "school_name", header: "school_name" },
  { key: "name", header: "name" },
  { key: "role", header: "role" },
  { key: "active", header: "active" },
];
