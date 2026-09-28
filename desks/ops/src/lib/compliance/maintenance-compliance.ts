import { classifyDays, daysUntil } from "./expiry-check";
import type { ComplianceCheck, ComplianceStatus } from "./expiry-check";
import type { MaintenanceRecord } from "@/lib/db/maintenance";

// Only "expired"/"expiring_soon" ever reach this after the "ok" filter below.
const SEVERITY_ORDER: Record<ComplianceStatus, number> = {
  expired: 0,
  missing: 1,
  expiring_soon: 2,
  ok: 3,
};

export function buildMaintenanceDueCompliance(
  record: Pick<MaintenanceRecord, "due_date" | "status">,
): ComplianceCheck | null {
  if (record.status === "done" || record.status === "cancelled") return null;
  if (!record.due_date) return null;

  const days = daysUntil(record.due_date);
  const status = classifyDays(days);
  if (status === "expired") {
    return {
      status: "expired",
      note: `Overdue by ${Math.abs(days)} day(s)`,
      days_remaining: days,
    };
  }
  if (status === "expiring_soon") {
    return {
      status: "expiring_soon",
      note: `Due in ${days} day(s)`,
      days_remaining: days,
    };
  }
  return {
    status: "ok",
    note: `Due in ${days} day(s) (on track)`,
    days_remaining: days,
  };
}

export function flagMaintenanceRecords(
  records: MaintenanceRecord[],
): { record: MaintenanceRecord; compliance: ComplianceCheck }[] {
  return records
    .map((record) => ({ record, compliance: buildMaintenanceDueCompliance(record) }))
    .filter(
      (
        x,
      ): x is { record: MaintenanceRecord; compliance: ComplianceCheck } =>
        x.compliance !== null && x.compliance.status !== "ok",
    )
    .sort((a, b) => SEVERITY_ORDER[a.compliance.status] - SEVERITY_ORDER[b.compliance.status]);
}
