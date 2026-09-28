import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import {
  buildOptimizedStopsView,
  getRouteStops,
  saveOptimizedRouteOrder,
} from "@/lib/db/queries";
import { getRouteCapacityCheck } from "@/lib/db/routes";

type Ctx = { params: Promise<{ routeId: string }> };

/**
 * POST /api/routes/[routeId]/optimize — admin only
 * Body: { force?: boolean } — force save even when over capacity
 */
export async function POST(request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  const { routeId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    force?: boolean;
  };

  const { routeName, stops } = await getRouteStops(routeId);
  if (!routeName || stops.length === 0) {
    return NextResponse.json(
      { error: "Route not found or has no stops" },
      { status: 404 },
    );
  }

  const capacity = await getRouteCapacityCheck(routeId);
  if (capacity.over_capacity && !body.force) {
    return NextResponse.json(
      {
        error: "Route over capacity — assign fewer students or raise bus capacity",
        code: "over_capacity",
        capacity,
        hint: "Pass { \"force\": true } to save optimized order anyway (admin).",
      },
      { status: 409 },
    );
  }

  const view = buildOptimizedStopsView(stops);
  const saved = await saveOptimizedRouteOrder({
    routeId,
    stopIdsInOrder: view.stops.map((s) => s.stop_id),
    etaOffsets: view.stops.map((s) => s.eta_offset_minutes ?? 0),
  });

  if ("error" in saved) {
    return NextResponse.json({ error: saved.error }, { status: 400 });
  }

  return NextResponse.json({
    route_id: routeId,
    route_name: routeName,
    distance_km: view.distanceKm,
    before_km: view.beforeKm,
    km_saved: Math.max(0, view.beforeKm - view.distanceKm),
    capacity,
    forced: Boolean(body.force && capacity.over_capacity),
    stops: view.stops.map((s) => ({
      order: s.stop_order,
      id: s.stop.id,
      name: s.stop.name,
      eta_offset_minutes: s.eta_offset_minutes,
    })),
  });
}
