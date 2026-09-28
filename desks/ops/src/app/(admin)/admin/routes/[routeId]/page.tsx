import Link from "next/link";
import { notFound } from "next/navigation";
import { getRouteStops } from "@/lib/db/queries";
import {
  getRouteById,
  getRouteCapacityCheck,
  listStops,
} from "@/lib/db/routes";
import { RouteBuilderClient } from "@/components/routes/RouteBuilderClient";

type Props = {
  params: Promise<{ routeId: string }>;
};

export default async function RouteDetailPage({ params }: Props) {
  const { routeId } = await params;
  const route = await getRouteById(routeId);
  if (!route) notFound();

  const [{ stops }, capacity, availableStops] = await Promise.all([
    getRouteStops(routeId),
    getRouteCapacityCheck(routeId),
    listStops(route.school_id),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link
        href="/admin/routes"
        className="text-sm font-semibold text-electric-blue no-underline"
      >
        ← Back to routes
      </Link>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-electric-blue">
          Route builder · Map + drag reorder
        </p>
        <h1 className="mt-1 text-2xl font-bold text-electric-blue">{route.name}</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {route.direction.toUpperCase()} ·{" "}
          {route.active ? "Active" : "Inactive"} · capacity{" "}
          {capacity.assigned_students}/{capacity.bus_capacity_total || "—"} assigned
        </p>
      </div>

      <div className="mt-6">
        <RouteBuilderClient
          routeId={route.id}
          routeName={route.name}
          direction={route.direction}
          schoolId={route.school_id}
          capacity={capacity}
          availableStops={availableStops}
          initialStops={stops.map((s) => ({
            id: s.stop.id,
            name: s.stop.name,
            kind: s.stop.kind,
            lat: s.stop.lat,
            lng: s.stop.lng,
            order: s.stop_order,
            eta_offset_minutes: s.eta_offset_minutes,
          }))}
        />
      </div>
    </main>
  );
}
