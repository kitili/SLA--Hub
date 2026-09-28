"use client";

import { useMemo, useState } from "react";
import type { MaintenanceRecord } from "@/lib/db/maintenance";
import { flagMaintenanceRecords } from "@/lib/compliance/maintenance-compliance";
import { COMPLIANCE_STATUS_STYLES } from "@/lib/compliance/expiry-check";
import type { School } from "@/types/database";
import { countBySchool } from "@/lib/dashboard/campus-count";
import { CampusCountChips } from "@/components/admin/CampusCountChips";

type BusOption = { id: string; school_id: string };

/** Fleet-wide banner listing open maintenance records that are overdue or due soon, grouped per campus. */
export function MaintenanceDueBanner({
  records,
  buses,
  schools,
}: {
  records: MaintenanceRecord[];
  buses: BusOption[];
  schools: School[];
}) {
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);

  const busSchoolMap = useMemo(
    () => new Map(buses.map((b) => [b.id, b.school_id])),
    [buses],
  );

  const flagged = useMemo(() => flagMaintenanceRecords(records), [records]);

  const campusCounts = useMemo(
    () =>
      countBySchool(
        flagged,
        (f) => (f.record.bus_id ? busSchoolMap.get(f.record.bus_id) : undefined),
        schools,
      ),
    [flagged, busSchoolMap, schools],
  );

  if (flagged.length === 0) return null;

  const visible = selectedSchoolId
    ? flagged.filter(
        (f) =>
          (f.record.bus_id ? busSchoolMap.get(f.record.bus_id) : undefined) ===
          selectedSchoolId,
      )
    : flagged;

  return (
    <div
      role="alert"
      className="rounded-[var(--radius)] border border-card-border bg-card px-4 py-3"
    >
      <p className="text-sm font-bold text-ink">Maintenance due</p>
      <CampusCountChips
        counts={campusCounts}
        selected={selectedSchoolId}
        onSelect={setSelectedSchoolId}
      />
      <ul className="mt-3 flex flex-col gap-2">
        {visible.map(({ record, compliance }) => (
          <li key={record.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-ink">
              {record.bus_label ?? record.bus_id ?? "Fleet-wide"}
            </span>
            <span className="text-ink-muted">{record.title}</span>
            <span
              className={`inline-block rounded-[var(--radius-sm)] px-2 py-1 text-xs font-semibold ${COMPLIANCE_STATUS_STYLES[compliance.status]}`}
            >
              {compliance.note}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
