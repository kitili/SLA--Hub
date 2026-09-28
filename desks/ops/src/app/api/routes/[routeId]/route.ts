import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { getRouteStops } from "@/lib/db/queries";
import {
  getRouteById,
  getRouteCapacityCheck,
  updateRoute,
} from "@/lib/db/routes";
import type { TripDirection } from "@/types/database";

type Ctx = { params: Promise<{ routeId: string }> };

/**
 * GET   /api/routes/[routeId] — route + stops + capacity
 * PATCH /api/routes/[routeId] — admin update
 */
export async function GET(_request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "transport", "matron", "driver", "finance"]);
  if ("response" in auth) return auth.response;

  const { routeId } = await context.params;
  const row = await getRouteById(routeId);
  if (!row) {
    return NextResponse.json({ error: "Route not found" }, { status: 404 });
  }

  const { routeName, stops } = await getRouteStops(routeId);
  const capacity = await getRouteCapacityCheck(routeId);

  return NextResponse.json({
    route: row,
    route_name: routeName,
    stops: stops.map((s) => ({
      order: s.stop_order,
      eta_offset_minutes: s.eta_offset_minutes,
      id: s.stop.id,
      name: s.stop.name,
      kind: s.stop.kind,
      lat: s.stop.lat,
      lng: s.stop.lng,
    })),
    capacity,
  });
}

export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  const { routeId } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    direction?: TripDirection;
    active?: boolean;
  };

  const outcome = await updateRoute(routeId, {
    name: body.name,
    direction: body.direction,
    active: body.active,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  return NextResponse.json({ route: outcome.route });
}
