import { csvTableToRecords, parseCsvTable } from "@/lib/import/csv-parse";
import type { ImportCommitResult, ImportPreview, ImportRowOutcome } from "@/lib/import/types";
import {
  createKitchenEquipment,
  updateKitchenEquipment,
  type KitchenEquipment,
  type KitchenEquipmentCategory,
  type KitchenEquipmentCondition,
} from "@/lib/db/kitchen";
import type { School } from "@/types/database";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORY_VALUES: KitchenEquipmentCategory[] = ["cookware", "appliance", "furniture", "other"];
const CONDITION_VALUES: KitchenEquipmentCondition[] = ["good", "fair", "poor", "needs_repair"];

export type KitchenEquipmentImportData = {
  matchedId: string | null;
  schoolId: string;
  name: string;
  category: KitchenEquipmentCategory;
  quantity: number;
  condition: KitchenEquipmentCondition;
  purchasedOn: string | null;
  replacementCost: number | null;
  notes: string | null;
};

export type KitchenEquipmentImportContext = {
  schools: Pick<School, "id" | "name" | "slug">[];
  equipment: Pick<KitchenEquipment, "id" | "school_id" | "name">[];
};

const REQUIRED_HEADERS = ["name"];

function resolveSchool(
  raw: string,
  schools: KitchenEquipmentImportContext["schools"],
): School | undefined {
  const needle = raw.trim().toLowerCase();
  return schools.find(
    (s) => s.slug.toLowerCase() === needle || s.name.toLowerCase() === needle,
  ) as School | undefined;
}

export function parseKitchenEquipmentImport(
  csvText: string,
  context: KitchenEquipmentImportContext,
): ImportPreview<KitchenEquipmentImportData> {
  const { headers, records } = csvTableToRecords(parseCsvTable(csvText));
  const headerErrors: string[] = [];
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  for (const required of REQUIRED_HEADERS) {
    if (!lowerHeaders.includes(required)) headerErrors.push(`Missing required column "${required}"`);
  }
  if (!lowerHeaders.includes("school_name") && !lowerHeaders.includes("school")) {
    headerErrors.push('Missing required column "school_name" (or "school")');
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

  // (school_id, name) case-insensitive -- same matching approach as
  // resolveSchool/busByKey in buses-import.ts.
  const equipmentByKey = new Map(
    context.equipment.map((e) => [`${e.school_id}::${e.name.trim().toLowerCase()}`, e]),
  );

  const rows: ImportRowOutcome<KitchenEquipmentImportData>[] = records.map((raw, i) => {
    const rowNum = i + 2;
    const errors: string[] = [];

    const schoolRaw = raw["school_name"]?.trim() || raw["school"]?.trim() || "";
    const school = schoolRaw ? resolveSchool(schoolRaw, context.schools) : undefined;
    if (!schoolRaw) errors.push("school_name is required");
    else if (!school) errors.push(`No campus found matching "${schoolRaw}"`);

    const name = raw["name"]?.trim() ?? "";
    if (!name) errors.push("name is required");

    const categoryRaw = raw["category"]?.trim().toLowerCase() ?? "";
    if (!categoryRaw) errors.push("category is required");
    else if (!CATEGORY_VALUES.includes(categoryRaw as KitchenEquipmentCategory)) {
      errors.push(`category must be one of: ${CATEGORY_VALUES.join(", ")}`);
    }

    const conditionRaw = raw["condition"]?.trim().toLowerCase() ?? "";
    if (!conditionRaw) errors.push("condition is required");
    else if (!CONDITION_VALUES.includes(conditionRaw as KitchenEquipmentCondition)) {
      errors.push(`condition must be one of: ${CONDITION_VALUES.join(", ")}`);
    }

    const quantityRaw = raw["quantity"]?.trim() ?? "";
    const quantity = quantityRaw ? Number(quantityRaw) : NaN;
    if (!quantityRaw) errors.push("quantity is required");
    else if (!Number.isInteger(quantity) || quantity <= 0) {
      errors.push("quantity must be a positive whole number");
    }

    const purchasedOn = raw["purchased_on"]?.trim() || null;
    if (purchasedOn && !DATE_RE.test(purchasedOn)) {
      errors.push("purchased_on must be YYYY-MM-DD");
    }

    const replacementCostRaw = raw["replacement_cost"]?.trim();
    const replacementCost = replacementCostRaw ? Number(replacementCostRaw) : null;
    if (replacementCostRaw && (Number.isNaN(replacementCost) || replacementCost! < 0)) {
      errors.push("replacement_cost must be a non-negative number");
    }

    const notes = raw["notes"]?.trim() || null;

    if (errors.length > 0) {
      return { row: rowNum, status: "error", errors, raw };
    }

    const matched = equipmentByKey.get(`${school!.id}::${name.toLowerCase()}`);

    return {
      row: rowNum,
      status: "valid",
      action: matched ? "update" : "create",
      matchedId: matched?.id,
      data: {
        matchedId: matched?.id ?? null,
        schoolId: school!.id,
        name,
        category: categoryRaw as KitchenEquipmentCategory,
        quantity,
        condition: conditionRaw as KitchenEquipmentCondition,
        purchasedOn,
        replacementCost,
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

export async function commitKitchenEquipmentImport(
  preview: ImportPreview<KitchenEquipmentImportData>,
): Promise<ImportCommitResult> {
  const result: ImportCommitResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const row of preview.rows) {
    if (row.status !== "valid") {
      result.skipped++;
      continue;
    }

    if (row.data.matchedId) {
      const outcome = await updateKitchenEquipment(row.data.matchedId, {
        name: row.data.name,
        category: row.data.category,
        quantity: row.data.quantity,
        condition: row.data.condition,
        purchasedOn: row.data.purchasedOn,
        replacementCost: row.data.replacementCost,
        notes: row.data.notes,
      });
      if ("error" in outcome) {
        result.errors.push({ row: row.row, message: outcome.error });
        result.skipped++;
      } else {
        result.updated++;
      }
    } else {
      const outcome = await createKitchenEquipment({
        schoolId: row.data.schoolId,
        name: row.data.name,
        category: row.data.category,
        quantity: row.data.quantity,
        condition: row.data.condition,
        purchasedOn: row.data.purchasedOn,
        replacementCost: row.data.replacementCost,
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
