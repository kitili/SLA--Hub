import type { CsvColumn } from "@/lib/export/csv-table";
import type { Sop } from "@/lib/db/facilities";

export type FacilitiesSopExportRow = Sop & {
  school_slug: string;
  school_name: string;
};

export const FACILITIES_SOP_EXPORT_COLUMNS: CsvColumn<FacilitiesSopExportRow>[] = [
  { key: "id", header: "id" },
  { key: "school_slug", header: "school" },
  { key: "school_name", header: "school_name" },
  { key: "title", header: "title" },
  { key: "category", header: "category" },
  { key: "content", header: "content" },
  { key: "created_by", header: "created_by" },
  { key: "created_at", header: "created_at" },
  { key: "updated_at", header: "updated_at" },
];