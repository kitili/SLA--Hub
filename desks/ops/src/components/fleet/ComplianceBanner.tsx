"use client";

import { useMemo, useState } from "react";
import type { BusWithCompliance } from "@/lib/db/drivers";
import { buildBusCompliance } from "@/lib/compliance/driver-compliance";
import {
  COMPLIANCE_STATUS_STYLES,
  pickWorst,
  SEVERITY_ORDER,
} from "@/lib/compliance/expiry-check";
import type { School } from "@/types/database";
import { countBySchool } from "@/lib/dashboard/campus-count";
import { CampusCountChips } from "@/components/admin/CampusCountChips";

/** Fleet-wide banner listing buses with a non-ok driver/insurance status, grouped per campus. */
export function ComplianceBanner({
  rows,
  schools,
}: {
  rows: BusWithCompliance[];
  schools: School[];
}) {
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);

  const flagged = useMemo(
    () =>
      rows
        .map((bus) => ({ bus, compliance: buildBusCompliance(bus, bus.driver) }))
        .filter(({ compliance }) => compliance.worst !== "ok")
        .sort(
          (a, b) => SEVERITY_ORDER[a.compliance.worst] - SEVERITY_ORDER[b.compliance.worst],
        ),
    [rows],
  );

  const campusCounts = useMemo(
    () => countBySchool(flagged, (f) => f.bus.school_id, schools),
    [flagged, schools],
  );

  if (flagged.length === 0) return null;

  const visible = selectedSchoolId
    ? flagged.filter((f) => f.bus.school_id === selectedSchoolId)
    : flagged;

  return (
    <div
      role="alert"
      className="rounded-[var(--radius)] border border-card-border bg-card px-4 py-3"
    >
      <p className="text-sm font-bold text-ink">Driver &amp; insurance compliance</p>
      <CampusCountChips
        counts={campusCounts}
        selected={selectedSchoolId}
        onSelect={setSelectedSchoolId}
      />
      <ul className="mt-3 flex flex-col gap-2">
        {visible.map(({ bus, compliance }) => {
          const worstDriverCheck = pickWorst(compliance.driver.checks);
          return (
            <li key={bus.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-ink">{bus.label}</span>
              {worstDriverCheck && worstDriverCheck.check.status !== "ok" ? (
                <span
                  className={`inline-block rounded-[var(--radius-sm)] px-2 py-1 text-xs font-semibold ${COMPLIANCE_STATUS_STYLES[worstDriverCheck.check.status]}`}
                >
                  {worstDriverCheck.check.note}
                </span>
              ) : null}
              {compliance.busInsurance.status !== "ok" ? (
                <span
                  className={`inline-block rounded-[var(--radius-sm)] px-2 py-1 text-xs font-semibold ${COMPLIANCE_STATUS_STYLES[compliance.busInsurance.status]}`}
                >
                  {compliance.busInsurance.note}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
