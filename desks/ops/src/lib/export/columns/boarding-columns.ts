import type { CsvColumn } from "@/lib/export/csv-table";
import type { BoardingReportRow } from "@/lib/db/queries";

export const BOARDING_EVENT_EXPORT_COLUMNS: CsvColumn<BoardingReportRow>[] = [
  { key: "id", header: "id" },
  { key: "trip_date", header: "trip_date" },
  { key: "direction", header: "direction" },
  { key: "bus_label", header: "bus" },
  { key: "student_name", header: "student" },
  { key: "class_name", header: "class" },
  { key: "event_type", header: "event" },
  { key: "scanned_at", header: "scanned_at" },
];
