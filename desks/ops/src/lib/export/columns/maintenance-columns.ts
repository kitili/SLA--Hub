import type { CsvColumn } from "@/lib/export/csv-table";
import type { MaintenanceRecord } from "@/lib/db/maintenance";

export const MAINTENANCE_EXPORT_COLUMNS: CsvColumn<MaintenanceRecord>[] = [
  { key: "id", header: "id" },
  { key: "bus_label", header: "bus" },
  { key: "bus_id", header: "bus_id" },
  { key: "title", header: "title" },
  { key: "category", header: "category" },
  { key: "status", header: "status" },
  { key: "cost", header: "cost" },
  { key: "budget_amount", header: "budget_amount" },
  { key: "currency", header: "currency" },
  { key: "service_date", header: "service_date" },
  { key: "due_date", header: "due_date" },
  { key: "notes", header: "notes" },
  { key: "created_at", header: "created_at" },
  { key: "updated_at", header: "updated_at" },
];
