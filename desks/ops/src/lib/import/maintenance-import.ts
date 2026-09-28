import { csvTableToRecords, parseCsvTable } from "@/lib/import/csv-parse";
import type { ImportCommitResult, ImportPreview, ImportRowOutcome } from "@/lib/import/types";
import {
  createMaintenance,
  type MaintenanceCategory,
  type MaintenanceRecord,
  type MaintenanceStatus,
} from "@/lib/db/maintenance";
import type { Bus } from "@/types/database";

const CATEGORIES: MaintenanceCategory[] = [
  "service",
  "repair",
  "tyre",
  "fuel_system",
  "body",
  "inspection",
  "other",
];
const STATUSES: MaintenanceStatus[] = ["open", "in_progress", "done", "cancelled"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type MaintenanceImportData = {
  busId: string | null;
  busLabel: string;
  title: string;
  category: MaintenanceCategory;
  status: MaintenanceStatus;
  cost: number;
  budgetAmount: number | null;
  currency: string;
  serviceDate: string | null;
  dueDate: string | null;
  notes: string | null;
};

export type MaintenanceImportContext = {
  buses: Pick<Bus, "id" | "label" | "school_id">[];
  existingRecords: Pick<MaintenanceRecord, "bus_id" | "title" | "service_date">[];
};

const REQUIRED_HEADERS = ["bus", "title"];

export function parseMaintenanceImport(
  csvText: string,
  context: MaintenanceImportContext,
): ImportPreview<MaintenanceImportData> {
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

  const busByLabel = new Map(
    context.buses.map((b) => [b.label.trim().toLowerCase(), b]),
  );

  const rows: ImportRowOutcome<MaintenanceImportData>[] = records.map((raw, i) => {
    const rowNum = i + 2; // +1 for header, +1 for 1-indexing
    const errors: string[] = [];

    // Blank bus = fleet-wide (e.g. "Labour charges" spanning multiple
    // buses). maintenance_records.bus_id is still NOT NULL live as of
    // 2026-08-19 (schema_maintenance.sql's "drop not null" migration is
    // written but not yet applied) -- a blank-bus row still passes preview
    // as valid, and createMaintenance returns a friendly, row-level error
    // at commit time until Kai runs that migration, rather than a raw
    // Postgres constraint violation.
    const busLabel = raw["bus"]?.trim() ?? "";
    const bus = busLabel ? busByLabel.get(busLabel.toLowerCase()) : undefined;
    if (busLabel && !bus) errors.push(`No bus found with label "${busLabel}"`);

    const title = raw["title"]?.trim() ?? "";
    if (!title) errors.push("title is required");

    const categoryRaw = raw["category"]?.trim().toLowerCase();
    const category = (categoryRaw || "repair") as MaintenanceCategory;
    if (categoryRaw && !CATEGORIES.includes(category)) {
      errors.push(`category must be one of: ${CATEGORIES.join(", ")}`);
    }

    const statusRaw = raw["status"]?.trim().toLowerCase();
    const status = (statusRaw || "open") as MaintenanceStatus;
    if (statusRaw && !STATUSES.includes(status)) {
      errors.push(`status must be one of: ${STATUSES.join(", ")}`);
    }

    const costRaw = raw["cost"]?.trim();
    const cost = costRaw ? Number(costRaw) : 0;
    if (costRaw && Number.isNaN(cost)) errors.push("cost must be a number");

    const budgetRaw = raw["budget_amount"]?.trim();
    const budgetAmount = budgetRaw ? Number(budgetRaw) : null;
    if (budgetRaw && Number.isNaN(budgetAmount)) errors.push("budget_amount must be a number");

    const serviceDate = raw["service_date"]?.trim() || null;
    if (serviceDate && !DATE_RE.test(serviceDate)) errors.push("service_date must be YYYY-MM-DD");

    const dueDate = raw["due_date"]?.trim() || null;
    if (dueDate && !DATE_RE.test(dueDate)) errors.push("due_date must be YYYY-MM-DD");

    if (errors.length > 0) {
      return { row: rowNum, status: "error", errors, raw };
    }

    return {
      row: rowNum,
      status: "valid",
      action: "create",
      data: {
        busId: bus?.id ?? null,
        busLabel: busLabel || "Fleet-wide",
        title,
        category,
        status,
        cost,
        budgetAmount,
        currency: raw["currency"]?.trim() || "TZS",
        serviceDate,
        dueDate,
        notes: raw["notes"]?.trim() || null,
      },
    };
  });

  const validRows = rows.filter(
    (r): r is Extract<typeof r, { status: "valid" }> => r.status === "valid",
  );
  const errorCount = rows.length - validRows.length;

  const nearDuplicateCount = validRows.filter((r) =>
    context.existingRecords.some(
      (e) =>
        e.bus_id === r.data.busId &&
        e.title.trim().toLowerCase() === r.data.title.trim().toLowerCase() &&
        e.service_date === r.data.serviceDate,
    ),
  ).length;
  const warnings =
    nearDuplicateCount > 0
      ? [
          `${nearDuplicateCount} row(s) look identical to existing records with the same bus + ` +
            `title + service_date — re-importing the same file will duplicate them.`,
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

export async function commitMaintenanceImport(
  preview: ImportPreview<MaintenanceImportData>,
): Promise<ImportCommitResult> {
  const result: ImportCommitResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const row of preview.rows) {
    if (row.status !== "valid") {
      result.skipped++;
      continue;
    }
    const outcome = await createMaintenance({
      busId: row.data.busId,
      title: row.data.title,
      category: row.data.category,
      status: row.data.status,
      cost: row.data.cost,
      budgetAmount: row.data.budgetAmount,
      currency: row.data.currency,
      notes: row.data.notes,
      serviceDate: row.data.serviceDate,
      dueDate: row.data.dueDate,
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
