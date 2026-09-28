import type { CsvColumn } from "@/lib/export/csv-table";
import type { Bus } from "@/types/database";

export type BusExportRow = Bus & { school_slug: string; school_name: string };

export const BUS_EXPORT_COLUMNS: CsvColumn<BusExportRow>[] = [
  { key: "id", header: "id" },
  { key: "school_slug", header: "school" },
  { key: "school_name", header: "school_name" },
  { key: "label", header: "label" },
  { key: "plate_number", header: "plate_number" },
  { key: "capacity", header: "capacity" },
  { key: "driver_name", header: "driver_name" },
  { key: "driver_id", header: "driver_id" },
  { key: "attendant_name", header: "attendant_name" },
  { key: "owner_name", header: "owner_name" },
  { key: "insurance_expiry", header: "insurance_expiry" },
  { key: "active", header: "active" },
  { key: "route_id", header: "route_id" },
];
