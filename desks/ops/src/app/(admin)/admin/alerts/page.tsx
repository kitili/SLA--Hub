import Link from "next/link";
import { getBuses, getSchools } from "@/lib/db/queries";
import { getBusesWithCompliance, getDriversWithPhotos } from "@/lib/db/drivers";
import { listMaintenance } from "@/lib/db/maintenance";
import { buildBusCompliance } from "@/lib/compliance/driver-compliance";
import { flagMaintenanceRecords } from "@/lib/compliance/maintenance-compliance";
import { IncidentAlertsList } from "@/components/admin/IncidentAlertsList";
import { FleetCompliancePanel } from "@/components/fleet/FleetCompliancePanel";
import { MaintenanceDueBanner } from "@/components/fleet/MaintenanceDueBanner";
import { AlertsTabs } from "@/components/admin/AlertsTabs";
import { getSessionProfile } from "@/lib/auth";

export default async function AdminAlertsPage() {
  const [session, busesWithCompliance, drivers, maintenanceRecords, buses, schools] =
    await Promise.all([
      getSessionProfile(),
      getBusesWithCompliance(),
      getDriversWithPhotos(),
      listMaintenance(),
      getBuses(),
      getSchools(),
    ]);

  const busOptions = buses.map((b) => ({ id: b.id, school_id: b.school_id }));

  const flaggedBusCount = busesWithCompliance.filter(
    (b) => buildBusCompliance(b, b.driver).worst !== "ok",
  ).length;
  const flaggedDriverCount = drivers.filter(
    (d) => buildBusCompliance({ insurance_expiry: null }, d).driver.worst !== "ok",
  ).length;
  const flaggedMaintenanceCount = flagMaintenanceRecords(maintenanceRecords).length;
  const complianceIssueCount = flaggedBusCount + flaggedMaintenanceCount;

  const canAck = session?.role === "admin" || session?.role === "transport";

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#001a4d] via-electric-blue to-[#003a8c] px-6 py-8 text-white shadow-[var(--shadow-lg)]">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold">
          Transport · Safety
        </p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-white">
          Alerts &amp; compliance
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/80">
          Incident escalations from the field (Buses → Alerts), plus Tanzania
          fleet compliance — licence, PSV, medical, insurance, and driver-file
          uploads. Unacknowledged escalations surface on the command center for
          super-admin action.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/ops/admin"
            className="rounded-xl border border-gold/40 bg-gold/20 px-4 py-2 text-sm font-semibold text-gold no-underline backdrop-blur hover:bg-gold/30"
          >
            Command center
          </Link>
          <Link
            href="/admin/incidents"
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white no-underline backdrop-blur hover:bg-white/20"
          >
            Incident log
          </Link>
          <Link
            href="/admin/drivers"
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white no-underline backdrop-blur hover:bg-white/20"
          >
            Drivers &amp; TZ file
          </Link>
        </div>
      </header>

      <AlertsTabs
        tabs={[
          {
            key: "incidents",
            label: "Incident escalations",
            content: <IncidentAlertsList canAcknowledge={canAck} />,
          },
          {
            key: "compliance",
            label: "Fleet compliance",
            badge: complianceIssueCount + flaggedDriverCount,
            content: (
              <div className="flex flex-col gap-5">
                <FleetCompliancePanel
                  busRows={busesWithCompliance}
                  drivers={drivers}
                  schools={schools}
                />
                {flaggedMaintenanceCount > 0 ? (
                  <MaintenanceDueBanner
                    records={maintenanceRecords}
                    buses={busOptions}
                    schools={schools}
                  />
                ) : null}
              </div>
            ),
          },
        ]}
      />
    </main>
  );
}
