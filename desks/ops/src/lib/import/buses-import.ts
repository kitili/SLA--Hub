import { csvTableToRecords, parseCsvTable } from "@/lib/import/csv-parse";
import type { ImportCommitResult, ImportPreview, ImportRowOutcome } from "@/lib/import/types";
import { createBus, updateBus } from "@/lib/db/queries";
import type { Bus, School } from "@/types/database";

export type BusImportData = {
  matchedId: string | null;
  schoolId: string;
  label: string;
  plateNumber: string;
  capacity: number | null;
  driverName: string | null;
  attendantName: string | null;
  ownerName: string | null;
};

export type BusImportContext = {
  schools: Pick<School, "id" | "name" | "slug">[];
  buses: Pick<Bus, "id" | "school_id" | "label">[];
};

const REQUIRED_HEADERS = ["school", "label", "plate_number"];

function resolveSchool(
  raw: string,
  schools: BusImportContext["schools"],
): School | undefined {
  const needle = raw.trim().toLowerCase();
  return schools.find(
    (s) => s.slug.toLowerCase() === needle || s.name.toLowerCase() === needle,
  ) as School | undefined;
}

export function parseBusesImport(
  csvText: string,
  context: BusImportContext,
): ImportPreview<BusImportData> {
  const { headers, records } = csvTableToRecords(parseCsvTable(csvText));
  const headerErrors: string[] = [];
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  for (const required of REQUIRED_HEADERS) {
    if (!lowerHeaders.includes(required)) headerErrors.push(`Missing required column "${required}"`);
  }
  if (headerErrors.length > 0) {
    return {
      headerErrors,
      totalRows: 0,
      validCount: 0,
      errorCount: 0,
      createCount: 0,
      updateCount: 0,
      warnings: [],
      rows: [],
    };
  }

  // (school_id, label) case-insensitive -- same matching logic as
  // scripts/apply-real-bus-plates.mjs.
  const busByKey = new Map(
    context.buses.map((b) => [`${b.school_id}::${b.label.trim().toLowerCase()}`, b]),
  );

  const rows: ImportRowOutcome<BusImportData>[] = records.map((raw, i) => {
    const rowNum = i + 2;
    const errors: string[] = [];

    const schoolRaw = raw["school"]?.trim() ?? "";
    const school = schoolRaw ? resolveSchool(schoolRaw, context.schools) : undefined;
    if (!schoolRaw) errors.push("school is required");
    else if (!school) errors.push(`No campus found matching "${schoolRaw}"`);

    const label = raw["label"]?.trim() ?? "";
    if (!label) errors.push("label is required");

    const plateNumber = raw["plate_number"]?.trim() ?? "";
    if (!plateNumber) errors.push("plate_number is required");

    const capacityRaw = raw["capacity"]?.trim();
    const capacity = capacityRaw ? Number(capacityRaw) : null;
    if (capacityRaw && (Number.isNaN(capacity) || capacity! <= 0)) {
      errors.push("capacity must be a positive number");
    }

    if (errors.length > 0) {
      return { row: rowNum, status: "error", errors, raw };
    }

    const existing = busByKey.get(`${school!.id}::${label.toLowerCase()}`);

    return {
      row: rowNum,
      status: "valid",
      action: existing ? "update" : "create",
      matchedId: existing?.id,
      data: {
        matchedId: existing?.id ?? null,
        schoolId: school!.id,
        label,
        plateNumber,
        capacity,
        driverName: raw["driver_name"]?.trim() || null,
        attendantName: raw["attendant_name"]?.trim() || null,
        ownerName: raw["owner_name"]?.trim() || null,
      },
    };
  });

  const validRows = rows.filter(
    (r): r is Extract<typeof r, { status: "valid" }> => r.status === "valid",
  );
  const errorCount = rows.length - validRows.length;
  const createCount = validRows.filter((r) => r.action === "create").length;
  const updateCount = validRows.filter((r) => r.action === "update").length;

  return {
    headerErrors: [],
    totalRows: rows.length,
    validCount: validRows.length,
    errorCount,
    createCount,
    updateCount,
    warnings: [],
    rows,
  };
}

export async function commitBusesImport(
  preview: ImportPreview<BusImportData>,
): Promise<ImportCommitResult> {
  const result: ImportCommitResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const row of preview.rows) {
    if (row.status !== "valid") {
      result.skipped++;
      continue;
    }

    if (row.data.matchedId) {
      const outcome = await updateBus(row.data.matchedId, {
        label: row.data.label,
        plateNumber: row.data.plateNumber,
        capacity: row.data.capacity ?? undefined,
        driverName: row.data.driverName ?? undefined,
        attendantName: row.data.attendantName ?? undefined,
        ownerName: row.data.ownerName ?? undefined,
      });
      if ("error" in outcome) {
        result.errors.push({ row: row.row, message: outcome.error });
        result.skipped++;
      } else {
        result.updated++;
      }
    } else {
      const outcome = await createBus({
        schoolId: row.data.schoolId,
        label: row.data.label,
        plateNumber: row.data.plateNumber,
        capacity: row.data.capacity ?? undefined,
        driverName: row.data.driverName,
        attendantName: row.data.attendantName,
        ownerName: row.data.ownerName,
      });
      if ("error" in outcome) {
        result.errors.push({ row: row.row, message: outcome.error });
        result.skipped++;
      } else {
        result.created++;
      }
    }
  }

  return result;
}
