import { csvTableToRecords, parseCsvTable } from "@/lib/import/csv-parse";
import type { ImportCommitResult, ImportPreview, ImportRowOutcome } from "@/lib/import/types";
import { createDriver, updateDriver, type Driver } from "@/lib/db/drivers";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type DriverImportData = {
  matchedId: string | null;
  name: string;
  licenseNumber: string | null;
  licenseExpiry: string | null;
  phone: string | null;
};

export type DriverImportContext = {
  drivers: Pick<Driver, "id" | "name" | "license_number">[];
};

const REQUIRED_HEADERS = ["name"];

export function parseDriversImport(
  csvText: string,
  context: DriverImportContext,
): ImportPreview<DriverImportData> {
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

  const byLicense = new Map(
    context.drivers
      .filter((d) => d.license_number)
      .map((d) => [d.license_number!.trim().toLowerCase(), d]),
  );
  const byName = new Map<string, typeof context.drivers>();
  for (const d of context.drivers) {
    const key = d.name.trim().toLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), d]);
  }

  const rows: ImportRowOutcome<DriverImportData>[] = records.map((raw, i) => {
    const rowNum = i + 2;
    const errors: string[] = [];

    const name = raw["name"]?.trim() ?? "";
    if (!name) errors.push("name is required");

    const licenseNumber = raw["license_number"]?.trim() || null;

    const licenseExpiry = raw["license_expiry"]?.trim() || null;
    if (licenseExpiry && !DATE_RE.test(licenseExpiry)) {
      errors.push("license_expiry must be YYYY-MM-DD");
    }

    let matched: Pick<Driver, "id" | "name" | "license_number"> | undefined;
    // Match by license_number first (closer to a real identity than free-text
    // name); fall back to name only when neither side has a license number.
    if (licenseNumber) {
      matched = byLicense.get(licenseNumber.toLowerCase());
    } else {
      const candidates = byName.get(name.toLowerCase()) ?? [];
      const withoutLicense = candidates.filter((d) => !d.license_number);
      if (withoutLicense.length > 1) {
        errors.push(
          `Ambiguous match: ${withoutLicense.length} existing drivers are named "${name}" with no ` +
            `license number to disambiguate — resolve manually instead of guessing.`,
        );
      } else {
        matched = withoutLicense[0];
      }
    }

    if (errors.length > 0) {
      return { row: rowNum, status: "error", errors, raw };
    }

    return {
      row: rowNum,
      status: "valid",
      action: matched ? "update" : "create",
      matchedId: matched?.id,
      data: {
        matchedId: matched?.id ?? null,
        name,
        licenseNumber,
        licenseExpiry,
        phone: raw["phone"]?.trim() || null,
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

export async function commitDriversImport(
  preview: ImportPreview<DriverImportData>,
): Promise<ImportCommitResult> {
  const result: ImportCommitResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const row of preview.rows) {
    if (row.status !== "valid") {
      result.skipped++;
      continue;
    }

    if (row.data.matchedId) {
      const outcome = await updateDriver(row.data.matchedId, {
        name: row.data.name,
        licenseNumber: row.data.licenseNumber,
        licenseExpiry: row.data.licenseExpiry,
        phone: row.data.phone,
      });
      if ("error" in outcome) {
        result.errors.push({ row: row.row, message: outcome.error });
        result.skipped++;
      } else {
        result.updated++;
      }
    } else {
      const outcome = await createDriver({
        name: row.data.name,
        licenseNumber: row.data.licenseNumber,
        licenseExpiry: row.data.licenseExpiry,
        phone: row.data.phone,
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
