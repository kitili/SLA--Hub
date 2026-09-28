import { csvTableToRecords, parseCsvTable } from "@/lib/import/csv-parse";
import type { ImportCommitResult, ImportPreview, ImportRowOutcome } from "@/lib/import/types";
import { createKitchenMenuItem, updateKitchenMenuItem, type KitchenMenuItem } from "@/lib/db/kitchen";

export type KitchenMenuItemImportData = {
  matchedId: string | null;
  name: string;
  notes: string | null;
};

export type KitchenMenuItemImportContext = {
  items: Pick<KitchenMenuItem, "id" | "name">[];
};

const REQUIRED_HEADERS = ["name"];

export function parseKitchenMenuItemsImport(
  csvText: string,
  context: KitchenMenuItemImportContext,
): ImportPreview<KitchenMenuItemImportData> {
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

  // name is the only identity we have for this global catalog (no per-campus
  // scoping, no license/plate-style natural key) -- same one-map matching
  // shape as drivers-import's byName fallback path.
  const byName = new Map(context.items.map((item) => [item.name.trim().toLowerCase(), item]));

  const rows: ImportRowOutcome<KitchenMenuItemImportData>[] = records.map((raw, i) => {
    const rowNum = i + 2;
    const errors: string[] = [];

    const name = raw["name"]?.trim() ?? "";
    if (!name) errors.push("name is required");

    const notes = raw["notes"]?.trim() || null;

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
        notes,
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

export async function commitKitchenMenuItemsImport(
  preview: ImportPreview<KitchenMenuItemImportData>,
): Promise<ImportCommitResult> {
  const result: ImportCommitResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const row of preview.rows) {
    if (row.status !== "valid") {
      result.skipped++;
      continue;
    }

    if (row.data.matchedId) {
      const outcome = await updateKitchenMenuItem(row.data.matchedId, {
        name: row.data.name,
        notes: row.data.notes,
      });
      if ("error" in outcome) {
        result.errors.push({ row: row.row, message: outcome.error });
        result.skipped++;
      } else {
        result.updated++;
      }
    } else {
      const outcome = await createKitchenMenuItem({
        name: row.data.name,
        notes: row.data.notes,
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
