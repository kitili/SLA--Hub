import { csvTableToRecords, parseCsvTable } from "@/lib/import/csv-parse";
import type { ImportCommitResult, ImportPreview, ImportRowOutcome } from "@/lib/import/types";
import {
  createKitchenStaffMember,
  updateKitchenStaffMember,
  type KitchenStaffMember,
  type KitchenStaffRole,
} from "@/lib/db/kitchen";
import type { School } from "@/types/database";

const ROLE_VALUES: KitchenStaffRole[] = ["cook", "head_of_kitchens", "other"];

export type KitchenStaffImportData = {
  matchedId: string | null;
  schoolId: string;
  name: string;
  role: KitchenStaffRole;
  active: boolean | null;
};

export type KitchenStaffImportContext = {
  schools: Pick<School, "id" | "name" | "slug">[];
  staff: Pick<KitchenStaffMember, "id" | "school_id" | "name">[];
};

const REQUIRED_HEADERS = ["name"];

function resolveSchool(
  raw: string,
  schools: KitchenStaffImportContext["schools"],
): School | undefined {
  const needle = raw.trim().toLowerCase();
  return schools.find(
    (s) => s.slug.toLowerCase() === needle || s.name.toLowerCase() === needle,
  ) as School | undefined;
}

export function parseKitchenStaffImport(
  csvText: string,
  context: KitchenStaffImportContext,
): ImportPreview<KitchenStaffImportData> {
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
  // equipmentByKey in kitchen-equipment-import.ts.
  const staffByKey = new Map(
    context.staff.map((s) => [`${s.school_id}::${s.name.trim().toLowerCase()}`, s]),
  );

  const rows: ImportRowOutcome<KitchenStaffImportData>[] = records.map((raw, i) => {
    const rowNum = i + 2;
    const errors: string[] = [];

    const schoolRaw = raw["school_name"]?.trim() || raw["school"]?.trim() || "";
    const school = schoolRaw ? resolveSchool(schoolRaw, context.schools) : undefined;
    if (!schoolRaw) errors.push("school_name is required");
    else if (!school) errors.push(`No campus found matching "${schoolRaw}"`);

    const name = raw["name"]?.trim() ?? "";
    if (!name) errors.push("name is required");

    const roleRaw = raw["role"]?.trim().toLowerCase() ?? "";
    if (!roleRaw) errors.push("role is required");
    else if (!ROLE_VALUES.includes(roleRaw as KitchenStaffRole)) {
      errors.push(`role must be one of: ${ROLE_VALUES.join(", ")}`);
    }

    const activeRaw = raw["active"]?.trim().toLowerCase();
    let active: boolean | null = null;
    if (activeRaw) {
      if (["true", "yes", "1"].includes(activeRaw)) active = true;
      else if (["false", "no", "0"].includes(activeRaw)) active = false;
      else errors.push('active must be one of: true, false, yes, no, 1, 0');
    }

    if (errors.length > 0) {
      return { row: rowNum, status: "error", errors, raw };
    }

    const matched = staffByKey.get(`${school!.id}::${name.toLowerCase()}`);

    return {
      row: rowNum,
      status: "valid",
      action: matched ? "update" : "create",
      matchedId: matched?.id,
      data: {
        matchedId: matched?.id ?? null,
        schoolId: school!.id,
        name,
        role: roleRaw as KitchenStaffRole,
        active,
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

export async function commitKitchenStaffImport(
  preview: ImportPreview<KitchenStaffImportData>,
): Promise<ImportCommitResult> {
  const result: ImportCommitResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const row of preview.rows) {
    if (row.status !== "valid") {
      result.skipped++;
      continue;
    }

    if (row.data.matchedId) {
      const outcome = await updateKitchenStaffMember(row.data.matchedId, {
        name: row.data.name,
        role: row.data.role,
        ...(row.data.active !== null ? { active: row.data.active } : {}),
      });
      if ("error" in outcome) {
        result.errors.push({ row: row.row, message: outcome.error });
        result.skipped++;
      } else {
        result.updated++;
      }
    } else {
      const outcome = await createKitchenStaffMember({
        schoolId: row.data.schoolId,
        name: row.data.name,
        role: row.data.role,
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
