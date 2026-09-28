import { getBuses, getSchools } from "@/lib/db/queries";
import { listHireOuts } from "@/lib/db/finance";
import { HireOutsClient } from "@/components/finance/HireOutsClient";
import { HireOutCalendar } from "@/components/finance/HireOutCalendar";

export default async function AdminHireOutsPage() {
  const [schools, buses, hireOuts] = await Promise.all([
    getSchools(),
    getBuses(),
    listHireOuts(),
  ]);

  const busOptions = buses.map((b) => ({
    id: b.id,
    label: b.label,
    plate_number: b.plate_number,
    school_id: b.school_id,
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-electric-blue">
          Admin · Finance
        </p>
        <h1 className="mt-1 text-2xl font-bold text-electric-blue">
          Hire-out bookings
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Book buses for weddings, burials, and events. Creates optional linked
          revenue via <code className="text-xs">POST /api/hire-outs</code>.
          Calendar below shows which buses are free vs on hire.
        </p>
      </div>

      <HireOutsClient
        schools={schools.map((s) => ({ id: s.id, name: s.name }))}
        buses={busOptions}
        initialHireOuts={hireOuts}
      />

      <HireOutCalendar
        buses={busOptions.map(({ id, label, plate_number }) => ({
          id,
          label,
          plate_number,
        }))}
        hireOuts={hireOuts}
      />
    </main>
  );
}
