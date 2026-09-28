import { csvTableToRecords, parseCsvTable } from "@/lib/import/csv-parse";
import type { ImportCommitResult, ImportPreview, ImportRowOutcome } from "@/lib/import/types";
import {
  createKitchenIngredient,
  updateKitchenIngredient,
  type KitchenCalcMethod,
  type KitchenIngredient,
  type KitchenIngredientCategory,
} from "@/lib/db/kitchen";

const CATEGORIES: KitchenIngredientCategory[] = ["grain", "vegetable", "meat", "other"];
const CALC_METHODS: KitchenCalcMethod[] = ["headcount_ratio", "flat_weekly"];

export type KitchenIngredientImportData = {
  matchedId: string | null;
  name: string;
  unit: string;
  category: KitchenIngredientCategory;
  calcMethod: KitchenCalcMethod;
  peoplePerKg: number | null;
  kgPerWeek: number | null;
  defaultUnitPrice: number;
};

export type KitchenIngredientImportContext = {
  ingredients: Pick<KitchenIngredient, "id" | "name">[];
};

const REQUIRED_HEADERS = ["name"];

/** Parses "123.45" -> 123.45, "" -> null. Returns undefined on invalid input
 * (non-empty but not a finite number) so the caller can surface a row error. */
function parseOptionalNumber(raw: string | undefined): number | null | undefined {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

export function parseKitchenIngredientsImport(
  csvText: string,
  context: KitchenIngredientImportContext,
): ImportPreview<KitchenIngredientImportData> {
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

  const byName = new Map(context.ingredients.map((ing) => [ing.name.trim().toLowerCase(), ing]));

  const rows: ImportRowOutcome<KitchenIngredientImportData>[] = records.map((raw, i) => {
    const rowNum = i + 2;
    const errors: string[] = [];

    const name = raw["name"]?.trim() ?? "";
    if (!name) errors.push("name is required");

    const unit = raw["unit"]?.trim() ?? "";
    if (!unit) errors.push("unit is required");

    const categoryRaw = raw["category"]?.trim() ?? "";
    const category = categoryRaw as KitchenIngredientCategory;
    if (!categoryRaw) errors.push("category is required");
    else if (!CATEGORIES.includes(category)) {
      errors.push(`category must be one of: ${CATEGORIES.join(", ")} (got "${categoryRaw}")`);
    }

    const calcMethodRaw = raw["calc_method"]?.trim() ?? "";
    const calcMethod = calcMethodRaw as KitchenCalcMethod;
    if (!calcMethodRaw) errors.push("calc_method is required");
    else if (!CALC_METHODS.includes(calcMethod)) {
      errors.push(`calc_method must be one of: ${CALC_METHODS.join(", ")} (got "${calcMethodRaw}")`);
    }

    const peoplePerKg = parseOptionalNumber(raw["people_per_kg"]);
    if (peoplePerKg === undefined) errors.push("people_per_kg must be a number");

    const kgPerWeek = parseOptionalNumber(raw["kg_per_week"]);
    if (kgPerWeek === undefined) errors.push("kg_per_week must be a number");

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
        category,
        calcMethod,
        peoplePerKg: peoplePerKg ?? null,
        kgPerWeek: kgPerWeek ?? null,
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

export async function commitKitchenIngredientsImport(
  preview: ImportPreview<KitchenIngredientImportData>,
): Promise<ImportCommitResult> {
  const result: ImportCommitResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const row of preview.rows) {
    if (row.status !== "valid") {
      result.skipped++;
      continue;
    }

    if (row.data.matchedId) {
      const outcome = await updateKitchenIngredient(row.data.matchedId, {
        name: row.data.name,
        unit: row.data.unit,
        category: row.data.category,
        calcMethod: row.data.calcMethod,
        peoplePerKg: row.data.peoplePerKg,
        kgPerWeek: row.data.kgPerWeek,
        defaultUnitPrice: row.data.defaultUnitPrice,
      });
      if ("error" in outcome) {
        result.errors.push({ row: row.row, message: outcome.error });
        result.skipped++;
      } else {
        result.updated++;
      }
    } else {
      const outcome = await createKitchenIngredient({
        name: row.data.name,
        unit: row.data.unit,
        category: row.data.category,
        calcMethod: row.data.calcMethod,
        peoplePerKg: row.data.peoplePerKg,
        kgPerWeek: row.data.kgPerWeek,
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
