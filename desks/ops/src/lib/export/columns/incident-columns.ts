import type { CsvColumn } from "@/lib/export/csv-table";
import type { Incident } from "@/types/database";

export type IncidentExportRow = Incident & { school_id: string | null };

export const INCIDENT_EXPORT_COLUMNS: CsvColumn<IncidentExportRow>[] = [
  { key: "id", header: "id" },
  { key: "created_at", header: "created_at" },
  { key: "school_id", header: "school_id" },
  { key: "trip_id", header: "trip_id" },
  { key: "type", header: "type" },
  { key: "severity", header: "severity" },
  { key: "notes", header: "notes" },
  { key: "lat", header: "lat" },
  { key: "lng", header: "lng" },
  { key: "reported_by", header: "reported_by" },
];
