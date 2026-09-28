import type { CsvColumn } from "@/lib/export/csv-table";
import type { KitchenMealAttendanceExportRow } from "@/lib/db/kitchen";

export const KITCHEN_MEAL_ATTENDANCE_EXPORT_COLUMNS: CsvColumn<KitchenMealAttendanceExportRow>[] = [
  { key: "id", header: "id" },
  { key: "school_name", header: "school_name" },
  { key: "serve_date", header: "serve_date" },
  { key: "meal_slot", header: "meal_slot" },
  { key: "actual_headcount", header: "actual_headcount" },
  { key: "notes", header: "notes" },
];
