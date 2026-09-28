import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { getBusById, getRouteStops } from "@/lib/db/queries";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/buses/:id/stops — live-sheet route stops for the bus's assigned route.
 * Used by Matron when picking a bus (before / during a driver trip).
 */
export async function GET(_request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "transport", "matron", "driver"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const bus = await getBusById(id);
  if (!bus) {
    return NextResponse.json({ error: "Bus not found" }, { status: 404 });
  }

  if (!bus.route_id) {
    return NextResponse.json({
      bus: { id: bus.id, label: bus.label, route_id: null },
      route_id: null,
      route_name: null,
      stops: [],
    });
  }

  const { routeName, stops } = await getRouteStops(bus.route_id);

  return NextResponse.json({
    bus: { id: bus.id, label: bus.label, route_id: bus.route_id },
    route_id: bus.route_id,
    route_name: routeName,
    stops: stops.map((s) => ({
      order: s.stop_order,
      id: s.stop.id,
      name: s.stop.name,
      kind: s.stop.kind,
      lat: s.stop.lat,
      lng: s.stop.lng,
      eta_offset_minutes: s.eta_offset_minutes,
    })),
  });
}
