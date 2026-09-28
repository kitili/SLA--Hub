import type { CsvColumn } from "@/lib/export/csv-table";
import type { Driver } from "@/lib/db/drivers";

// Scoped to currently-live columns only. next_of_kin_*/psv_permit_*/etc are
// in the Driver type but NOT yet live in prod (see the TEMPORARY comment in
// src/lib/db/drivers.ts) -- extend this list once that schema is confirmed
// live, same rule applied to that file all session.
export const DRIVER_EXPORT_COLUMNS: CsvColumn<Driver>[] = [
  { key: "id", header: "id" },
  { key: "name", header: "name" },
  { key: "license_number", header: "license_number" },
  { key: "license_expiry", header: "license_expiry" },
  { key: "phone", header: "phone" },
  { key: "active", header: "active" },
];
