import Link from "next/link";
import { getSchools } from "@/lib/db/queries";
import { IncidentsAdminList } from "@/components/admin/IncidentsAdminList";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";

export default async function AdminIncidentsPage() {
  const schools = await getSchools();
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#001a4d] via-electric-blue to-[#003a8c] px-6 py-8 text-white shadow-[var(--shadow-lg)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold">
              Transport · Safety
            </p>
            <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-white">
              Incidents
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/80">
              Delays, breakdowns, accidents, and medical events reported from
              matron tablets and the driver app. Tap the escalate dot to push an
              item to the{" "}
              <Link href="/ops/admin" className="font-semibold text-gold no-underline hover:underline">
                command center
              </Link>
              , or open the full feed under Buses →{" "}
              <Link href="/admin/alerts" className="font-semibold text-gold no-underline hover:underline">
                Alerts
              </Link>
              .
            </p>
          </div>
          <ExportCsvButton entity="incidents" />
        </div>
      </header>
      <IncidentsAdminList schools={schools} />
    </main>
  );
}
