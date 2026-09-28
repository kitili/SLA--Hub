import { csvTableToRecords, parseCsvTable } from "@/lib/import/csv-parse";
import type { ImportCommitResult, ImportPreview, ImportRowOutcome } from "@/lib/import/types";
import { createExpense, type Expense, type ExpenseCategory } from "@/lib/db/finance";
import type { Bus, School } from "@/types/database";

const CATEGORIES: ExpenseCategory[] = [
  "fuel",
  "maintenance",
  "salary",
  "insurance",
  "toll",
  "parts",
  "hire_cost",
  "other",
];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type ExpenseImportData = {
  schoolId: string | null;
  busId: string | null;
  category: ExpenseCategory;
  title: string;
  amount: number;
  currency: string;
  spentOn: string;
  notes: string | null;
};

export type ExpenseImportContext = {
  schools: Pick<School, "id" | "name" | "slug">[];
  buses: Pick<Bus, "id" | "label" | "plate_number">[];
  existingExpenses: Pick<Expense, "title" | "amount" | "spent_on">[];
};

const REQUIRED_HEADERS = ["title", "amount", "spent_on"];

export function parseExpenseImport(
  csvText: string,
  context: ExpenseImportContext,
): ImportPreview<ExpenseImportData> {
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

  const schoolByName = new Map(
    context.schools.map((s) => [s.name.trim().toLowerCase(), s]),
  );
  const schoolBySlug = new Map(
    context.schools.map((s) => [s.slug.trim().toLowerCase(), s]),
  );
  const busByLabel = new Map(context.buses.map((b) => [b.label.trim().toLowerCase(), b]));
  const busByPlate = new Map(
    context.buses.map((b) => [b.plate_number.trim().toLowerCase(), b]),
  );

  const rows: ImportRowOutcome<ExpenseImportData>[] = records.map((raw, i) => {
    const rowNum = i + 2;
    const errors: string[] = [];

    const title = raw["title"]?.trim() ?? "";
    if (!title) errors.push("title is required");

    const amountRaw = raw["amount"]?.trim();
    const amount = amountRaw ? Number(amountRaw) : NaN;
    if (!amountRaw) errors.push("amount is required");
    else if (Number.isNaN(amount) || amount < 0) errors.push("amount must be a non-negative number");

    const spentOn = raw["spent_on"]?.trim() ?? "";
    if (!spentOn) errors.push("spent_on is required");
    else if (!DATE_RE.test(spentOn)) errors.push("spent_on must be YYYY-MM-DD");

    const categoryRaw = raw["category"]?.trim().toLowerCase();
    const category = (categoryRaw || "other") as ExpenseCategory;
    if (categoryRaw && !CATEGORIES.includes(category)) {
      errors.push(`category must be one of: ${CATEGORIES.join(", ")}`);
    }

    const schoolRaw = raw["school"]?.trim() ?? "";
    const school = schoolRaw
      ? schoolByName.get(schoolRaw.toLowerCase()) ?? schoolBySlug.get(schoolRaw.toLowerCase())
      : undefined;
    if (schoolRaw && !school) errors.push(`No campus found matching "${schoolRaw}"`);

    const busRaw = raw["bus"]?.trim() ?? "";
    const bus = busRaw
      ? busByLabel.get(busRaw.toLowerCase()) ?? busByPlate.get(busRaw.toLowerCase())
      : undefined;
    if (busRaw && !bus) errors.push(`No bus found matching "${busRaw}"`);

    if (errors.length > 0) {
      return { row: rowNum, status: "error", errors, raw };
    }

    return {
      row: rowNum,
      status: "valid",
      action: "create",
      data: {
        schoolId: school?.id ?? null,
        busId: bus?.id ?? null,
        category,
        title,
        amount,
        currency: raw["currency"]?.trim() || "TZS",
        spentOn,
        notes: raw["notes"]?.trim() || null,
      },
    };
  });

  const validRows = rows.filter(
    (r): r is Extract<typeof r, { status: "valid" }> => r.status === "valid",
  );
  const errorCount = rows.length - validRows.length;

  const nearDuplicateCount = validRows.filter((r) =>
    context.existingExpenses.some(
      (e) =>
        e.title.trim().toLowerCase() === r.data.title.trim().toLowerCase() &&
        Number(e.amount) === r.data.amount &&
        e.spent_on === r.data.spentOn,
    ),
  ).length;
  const warnings =
    nearDuplicateCount > 0
      ? [
          `${nearDuplicateCount} row(s) look identical to existing expenses with the same ` +
            `title + amount + spent_on — re-importing the same file will duplicate them.`,
        ]
      : [];

  return {
    headerErrors: [],
    totalRows: rows.length,
    validCount: validRows.length,
    errorCount,
    createCount: validRows.length,
    updateCount: 0,
    warnings,
    rows,
  };
}

export async function commitExpenseImport(
  preview: ImportPreview<ExpenseImportData>,
): Promise<ImportCommitResult> {
  const result: ImportCommitResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const row of preview.rows) {
    if (row.status !== "valid") {
      result.skipped++;
      continue;
    }
    const outcome = await createExpense({
      schoolId: row.data.schoolId,
      busId: row.data.busId,
      category: row.data.category,
      title: row.data.title,
      amount: row.data.amount,
      currency: row.data.currency,
      spentOn: row.data.spentOn,
      notes: row.data.notes,
    });
    if ("error" in outcome) {
      result.errors.push({ row: row.row, message: outcome.error });
      result.skipped++;
    } else {
      result.created++;
    }
  }

  return result;
}
