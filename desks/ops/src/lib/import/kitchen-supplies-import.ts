import { csvTableToRecords, parseCsvTable } from "@/lib/import/csv-parse";
import type { ImportCommitResult, ImportPreview, ImportRowOutcome } from "@/lib/import/types";
import { createKitchenSupply, updateKitchenSupply, type KitchenSupply } from "@/lib/db/kitchen";

export type KitchenSupplyImportData = {
  matchedId: string | null;
  name: string;
  unit: string;
  defaultUnitPrice: number;
};

// NOTE: callers must pass ALL supplies here (active and inactive), not just
// listKitchenSupplies()'s active-only result -- otherwise an inactive supply
// re-imported by name would look unmatched and get created as a duplicate
// instead of updated. See report to the caller re: listKitchenSupplies filter.
export type KitchenSupplyImportContext = {
  supplies: Pick<KitchenSupply, "id" | "name">[];
};

const REQUIRED_HEADERS = ["name"];

export function parseKitchenSuppliesImport(
  csvText: string,
  context: KitchenSupplyImportContext,
): ImportPreview<KitchenSupplyImportData> {
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

  const byName = new Map(context.supplies.map((s) => [s.name.trim().toLowerCase(), s]));

  const rows: ImportRowOutcome<KitchenSupplyImportData>[] = records.map((raw, i) => {
    const rowNum = i + 2;
    const errors: string[] = [];

    const name = raw["name"]?.trim() ?? "";
    if (!name) errors.push("name is required");

    const unit = raw["unit"]?.trim() ?? "";
    if (!unit) errors.push("unit is required");

    const defaultUnitPriceRaw = raw["default_unit_price"]?.trim() ?? "";
    const defaultUnitPrice = defaultUnitPriceRaw ? Number(defaultUnitPriceRaw) : 0;
    if (defaultUnitPriceRaw && !Number.isFinite(defaultUnitPrice)) {
      errors.push("default_unit_price must be a number");
    }

    if (errors.length > 0) {
      return { row: rowNum, status: "error", errors, raw };
    }

    const matched = byName.get(name.toLowerCase());

    return {
      row: rowNum,
      status: "valid",
      action: matched ? "update" : "create",
      matchedId: matched?.id,
      data: {
        matchedId: matched?.id ?? null,
        name,
        unit,
        defaultUnitPrice,
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

export async function commitKitchenSuppliesImport(
  preview: ImportPreview<KitchenSupplyImportData>,
): Promise<ImportCommitResult> {
  const result: ImportCommitResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const row of preview.rows) {
    if (row.status !== "valid") {
      result.skipped++;
      continue;
    }

    if (row.data.matchedId) {
      const outcome = await updateKitchenSupply(row.data.matchedId, {
        name: row.data.name,
        unit: row.data.unit,
        defaultUnitPrice: row.data.defaultUnitPrice,
      });
      if ("error" in outcome) {
        result.errors.push({ row: row.row, message: outcome.error });
        result.skipped++;
      } else {
        result.updated++;
      }
    } else {
      const outcome = await createKitchenSupply({
        name: row.data.name,
        unit: row.data.unit,
        defaultUnitPrice: row.data.defaultUnitPrice,
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
