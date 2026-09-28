import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { assertDriverCanUseTrip } from "@/lib/driver/access";
import {
  buildOptimizedStopsView,
  getNavigationStopsForTrip,
  getStopsForTrip,
  getTripById,
} from "@/lib/db/queries";
import { computeEtaTimestamp } from "@/lib/routing/eta";

type Ctx = { params: Promise<{ tripId: string }> };

function clockEta(
  anchorIso: string | null | undefined,
  offsetMinutes: number | null,
): string | null {
  const at = computeEtaTimestamp(anchorIso, offsetMinutes);
  return at
    ? at.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Dar_es_Salaam",
      })
    : null;
}

/**
 * GET /api/trips/[tripId]/stops
 * Default (drivers): navigation stops = student-assigned pins in saved order.
 * ?all=1 — every route_stop (admin tooling).
 * ?optimized=1 — NN+2-opt preview only (does not change saved order).
 */
export async function GET(request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "transport", "matron", "driver", "finance"]);
  if ("response" in auth) return auth.response;

  const { tripId } = await context.params;

  const access = await assertDriverCanUseTrip(auth.supabase, {
    userId: auth.userId,
    role: auth.role,
    tripId,
  });
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const trip = await getTripById(tripId);
  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const optimized = url.searchParams.get("optimized") === "1";
  const allStops = url.searchParams.get("all") === "1";

  const { routeId, routeName, stops: baseStops } = allStops
    ? await getStopsForTrip(tripId)
    : await getNavigationStopsForTrip(tripId, trip.trip_date, trip.direction);

  const view = optimized
    ? buildOptimizedStopsView(baseStops)
    : {
        stops: baseStops,
        distanceKm: null as number | null,
        beforeKm: null as number | null,
      };

  const anchor =
    trip.departed_school_at ?? trip.started_at ?? new Date().toISOString();

  return NextResponse.json({
    trip: {
      id: trip.id,
      status: trip.status,
      direction: trip.direction,
      departed_school_at: trip.departed_school_at ?? null,
      started_at: trip.started_at,
      ended_at: trip.ended_at ?? null,
      bus_label: trip.bus_label,
    },
    route_id: routeId,
    route_name: routeName,
    optimized,
    navigation: !allStops,
    distance_km: view.distanceKm,
    before_km: view.beforeKm,
    km_saved:
      view.beforeKm != null && view.distanceKm != null
        ? Math.max(0, view.beforeKm - view.distanceKm)
        : null,
    stops: view.stops.map((s) => ({
      order: s.stop_order,
      eta_offset_minutes: s.eta_offset_minutes,
      eta_clock: clockEta(anchor, s.eta_offset_minutes),
      id: s.stop.id,
      name: s.stop.name,
      kind: s.stop.kind,
      lat: s.stop.lat,
      lng: s.stop.lng,
    })),
  });
}
