"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { BusWithCompliance } from "@/lib/db/drivers";
import type { DriverWithPhotoUrls } from "@/lib/db/drivers";
import { buildBusCompliance } from "@/lib/compliance/driver-compliance";
import {
  COMPLIANCE_STATUS_STYLES,
  pickWorst,
  SEVERITY_ORDER,
} from "@/lib/compliance/expiry-check";
import { docCompletionPercent } from "@/lib/compliance/tz-driver-docs";
import type { School } from "@/types/database";
import { countBySchool } from "@/lib/dashboard/campus-count";
import { CampusCountChips } from "@/components/admin/CampusCountChips";

type Props = {
  busRows: BusWithCompliance[];
  drivers: DriverWithPhotoUrls[];
  schools: School[];
};

function StatusPill({ status, children }: { status: string; children: React.ReactNode }) {
  const style =
    COMPLIANCE_STATUS_STYLES[status as keyof typeof COMPLIANCE_STATUS_STYLES] ??
    "bg-light-blue-30 text-ink";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold ${style}`}>
      {children}
    </span>
  );
}

/** Fleet compliance — buses + driver TZ file status, grouped by campus. */
export function FleetCompliancePanel({ busRows, drivers, schools }: Props) {
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [view, setView] = useState<"buses" | "drivers">("drivers");

  const flaggedBuses = useMemo(
    () =>
      busRows
        .map((bus) => ({ bus, compliance: buildBusCompliance(bus, bus.driver) }))
        .filter(({ compliance }) => compliance.worst !== "ok")
        .sort(
          (a, b) => SEVERITY_ORDER[a.compliance.worst] - SEVERITY_ORDER[b.compliance.worst],
        ),
    [busRows],
  );

  const flaggedDrivers = useMemo(
    () =>
      drivers
        .map((driver) => ({
          driver,
          compliance: buildBusCompliance({ insurance_expiry: null }, driver).driver,
          filePct: docCompletionPercent(driver),
        }))
        .filter(({ compliance }) => compliance.worst !== "ok")
        .sort(
          (a, b) => SEVERITY_ORDER[a.compliance.worst] - SEVERITY_ORDER[b.compliance.worst],
        ),
    [drivers],
  );

  const campusCounts = useMemo(
    () => countBySchool(flaggedBuses, (f) => f.bus.school_id, schools),
    [flaggedBuses, schools],
  );

  const visibleBuses = selectedSchoolId
    ? flaggedBuses.filter((f) => f.bus.school_id === selectedSchoolId)
    : flaggedBuses;

  if (flaggedBuses.length === 0 && flaggedDrivers.length === 0) {
    return (
      <div className="rounded-2xl border border-success/25 bg-gradient-to-br from-success-15 to-white p-8 text-center shadow-[var(--shadow)]">
        <p className="font-display text-lg font-bold text-success">Fleet compliance clear</p>
        <p className="mt-2 text-sm text-ink-muted">
          All assigned drivers have renewals and Tanzania driver-file uploads in order.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setView("drivers")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            view === "drivers"
              ? "bg-electric-blue text-white shadow-md"
              : "border border-card-border bg-white text-ink-muted hover:text-ink"
          }`}
        >
          By driver
          {flaggedDrivers.length > 0 ? (
            <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-xs">
              {flaggedDrivers.length}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => setView("buses")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            view === "buses"
              ? "bg-electric-blue text-white shadow-md"
              : "border border-card-border bg-white text-ink-muted hover:text-ink"
          }`}
        >
          By bus
          {flaggedBuses.length > 0 ? (
            <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-xs">
              {flaggedBuses.length}
            </span>
          ) : null}
        </button>
        <Link
          href="/admin/drivers"
          className="ml-auto self-center text-sm font-semibold text-electric-blue no-underline hover:underline"
        >
          Open Drivers →
        </Link>
      </div>

      {view === "buses" ? (
        <div
          role="alert"
          className="rounded-2xl border border-card-border bg-white p-5 shadow-[var(--shadow)]"
        >
          <p className="font-display text-base font-bold text-ink">
            Buses needing attention
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Insurance expiry or assigned driver renewals / missing TZ documents.
          </p>
          <CampusCountChips
            counts={campusCounts}
            selected={selectedSchoolId}
            onSelect={setSelectedSchoolId}
          />
          <ul className="mt-4 flex flex-col gap-3">
            {visibleBuses.map(({ bus, compliance }) => {
              const worstDriverCheck = pickWorst(compliance.driver.checks);
              const filePct = docCompletionPercent(bus.driver);
              return (
                <li
                  key={bus.id}
                  className="rounded-xl border border-card-border bg-[#f7f9fc] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display font-bold text-electric-blue">{bus.label}</span>
                    <StatusPill status={compliance.worst}>
                      {compliance.worst === "expired"
                        ? "Expired"
                        : compliance.worst === "expiring_soon"
                          ? "Due soon"
                          : "Incomplete"}
                    </StatusPill>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {bus.driver?.name ?? "No driver assigned"} · TZ file {filePct}% complete
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {worstDriverCheck && worstDriverCheck.check.status !== "ok" ? (
                      <StatusPill status={worstDriverCheck.check.status}>
                        {worstDriverCheck.check.note}
                      </StatusPill>
                    ) : null}
                    {compliance.busInsurance.status !== "ok" ? (
                      <StatusPill status={compliance.busInsurance.status}>
                        {compliance.busInsurance.note}
                      </StatusPill>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {flaggedDrivers.map(({ driver, compliance, filePct }) => {
            const issues = Object.values(compliance.checks)
              .filter((c) => c.status !== "ok")
              .sort((a, b) => SEVERITY_ORDER[a.status] - SEVERITY_ORDER[b.status]);
            return (
              <li
                key={driver.id}
                className="rounded-2xl border border-card-border bg-white p-4 shadow-[var(--shadow)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-bold text-electric-blue">
                      {driver.name}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Tanzania driver file · {filePct}% complete
                      {driver.phone ? ` · ${driver.phone}` : ""}
                    </p>
                  </div>
                  <StatusPill status={compliance.worst}>
                    {compliance.worst === "ok" ? "OK" : compliance.worst.replace("_", " ")}
                  </StatusPill>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-light-blue-30">
                  <div
                    className={`h-full rounded-full transition-all ${
                      filePct >= 100 ? "bg-success" : filePct >= 60 ? "bg-gold" : "bg-danger"
                    }`}
                    style={{ width: `${Math.max(filePct, 4)}%` }}
                  />
                </div>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {issues.slice(0, 6).map((check) => (
                    <StatusPill key={check.note} status={check.status}>
                      {check.note}
                    </StatusPill>
                  ))}
                  {issues.length > 6 ? (
                    <span className="text-xs text-ink-faint">+{issues.length - 6} more</span>
                  ) : null}
                </ul>
                <Link
                  href="/admin/drivers"
                  className="mt-3 inline-block text-xs font-semibold text-electric-blue no-underline hover:underline"
                >
                  Review on Drivers page →
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
