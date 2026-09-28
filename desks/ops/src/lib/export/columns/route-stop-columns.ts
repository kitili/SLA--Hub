import type { CsvColumn } from "@/lib/export/csv-table";

export type RouteStopExportRow = {
  route_id: string;
  route_name: string;
  direction: string;
  school_slug: string;
  stop_order: number;
  stop_name: string;
  stop_kind: string;
  lat: number | null;
  lng: number | null;
  eta_offset_minutes: number | null;
};

export const ROUTE_STOP_EXPORT_COLUMNS: CsvColumn<RouteStopExportRow>[] = [
  { key: "route_id", header: "route_id" },
  { key: "route_name", header: "route_name" },
  { key: "direction", header: "direction" },
  { key: "school_slug", header: "school" },
  { key: "stop_order", header: "stop_order" },
  { key: "stop_name", header: "stop_name" },
  { key: "stop_kind", header: "stop_kind" },
  { key: "lat", header: "lat" },
  { key: "lng", header: "lng" },
  { key: "eta_offset_minutes", header: "eta_offset_minutes" },
];
