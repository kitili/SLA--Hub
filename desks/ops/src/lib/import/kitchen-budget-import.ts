import { csvTableToRecords, parseCsvTable } from "@/lib/import/csv-parse";
import type { ImportCommitResult, ImportPreview, ImportRowOutcome } from "@/lib/import/types";
import {
  upsertKitchenBudget,
  type KitchenBudgetExportRow,
} from "@/lib/db/kitchen";
import type { School } from "@/types/database";

export type KitchenBudgetImportData = {
  matchedId: string | null;
  schoolId: string;
  month: string;
  budgetAmount: number;
  currency: string;
};

export type KitchenBudgetImportContext = {
  schools: Pick<School, "id" | "name" | "slug">[];
  budgets: Pick<KitchenBudgetExportRow, "id" | "school_id" | "month">[];
};

const REQUIRED_HEADERS = ["month", "budget_amount"];
const MONTH_RE = /^\d{4}-\d{2}(-\d{2})?$/;

function resolveSchool(
  raw: string,
  schools: KitchenBudgetImportContext["schools"],
): School | undefined {
  const needle = raw.trim().toLowerCase();
  return schools.find(
    (s) => s.slug.toLowerCase() === needle || s.name.toLowerCase() === needle,
  ) as School | undefined;
}

// The DB stores month as a first-of-month date (e.g. "2026-01-01"). Accept
// the more natural "2026-01" from whoever fills in the CSV, same relaxed-input
// idea as accepting "school" as well as "school_name" -- and always truncate
// to first-of-month (the day, if given, is discarded) so "2026-01-15" still
// matches the existing "2026-01-01" row for that campus instead of silently
// creating a second, orphaned budget row. MONTH_RE only checks digit shape,
// so the month number itself is validated separately here (01-12) rather
// than letting an out-of-range value like "2026-13" reach Postgres as a raw
// date-parse error.
function normalizeMonth(raw: string): string | null {
  const trimmed = raw.trim();
  if (!MONTH_RE.test(trimmed)) return null;
  const [year, month] = trimmed.split("-");
  const monthNum = Number(month);
  if (monthNum < 1 || monthNum > 12) return null;
  return `${year}-${month}-01`;
}

export function parseKitchenBudgetImport(
  csvText: string,
  context: KitchenBudgetImportContext,
): ImportPreview<KitchenBudgetImportData> {
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

  // (school_id, month) is the real unique key -- upsertKitchenBudget's own
  // onConflict target -- so a matched row is always an intentional overwrite
  // of that campus/month's figure, not a near-duplicate to warn about.
  const budgetByKey = new Map(
    context.budgets.map((b) => [`${b.school_id}::${b.month}`, b]),
  );

  const rows: ImportRowOutcome<KitchenBudgetImportData>[] = records.map((raw, i) => {
    const rowNum = i + 2;
    const errors: string[] = [];

    const schoolRaw = raw["school_name"]?.trim() || raw["school"]?.trim() || "";
    const school = schoolRaw ? resolveSchool(schoolRaw, context.schools) : undefined;
    if (!schoolRaw) errors.push("school_name is required");
    else if (!school) errors.push(`No campus found matching "${schoolRaw}"`);

    const monthRaw = raw["month"]?.trim() ?? "";
    const month = monthRaw ? normalizeMonth(monthRaw) : null;
    if (!monthRaw) errors.push("month is required");
    else if (!month) {
      errors.push('month must be "YYYY-MM" or "YYYY-MM-DD" with a real month (01-12)');
    }

    const amountRaw = raw["budget_amount"]?.trim() ?? "";
    const budgetAmount = Number(amountRaw);
    if (!amountRaw) errors.push("budget_amount is required");
    else if (!Number.isFinite(budgetAmount) || budgetAmount < 0) {
      errors.push("budget_amount must be a non-negative number");
    }

    const currency = raw["currency"]?.trim() || "TZS";

    if (errors.length > 0) {
      return { row: rowNum, status: "error", errors, raw };
    }

    const matched = budgetByKey.get(`${school!.id}::${month}`);

    return {
      row: rowNum,
      status: "valid",
      action: matched ? "update" : "create",
      matchedId: matched?.id,
      data: {
        matchedId: matched?.id ?? null,
        schoolId: school!.id,
        month: month!,
        budgetAmount,
        currency,
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

export async function commitKitchenBudgetImport(
  preview: ImportPreview<KitchenBudgetImportData>,
): Promise<ImportCommitResult> {
  const result: ImportCommitResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const row of preview.rows) {
    if (row.status !== "valid") {
      result.skipped++;
      continue;
    }
    const outcome = await upsertKitchenBudget({
      schoolId: row.data.schoolId,
      month: row.data.month,
      budgetAmount: row.data.budgetAmount,
      currency: row.data.currency,
    });
    if ("error" in outcome) {
      result.errors.push({ row: row.row, message: outcome.error });
      result.skipped++;
    } else if (row.action === "update") {
      result.updated++;
    } else {
      result.created++;
    }
  }

  return result;
}
