import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { getTripBoardingGroupedByStop } from "@/lib/db/queries";

type Ctx = { params: Promise<{ tripId: string }> };

/**
 * GET /api/trips/[tripId]/boarding-by-stop
 * Every live-sheet stop with students scanned there + exact times.
 */
export async function GET(_request: Request, context: Ctx) {
  const auth = await requireUser([
    "admin",
    "transport",
    "matron",
    "driver",
    "finance",
  ]);
  if ("response" in auth) return auth.response;

  const { tripId } = await context.params;
  if (!tripId) {
    return NextResponse.json({ error: "tripId required" }, { status: 400 });
  }

  const { routeName, stops } = await getTripBoardingGroupedByStop(tripId);

  return NextResponse.json({
    route_name: routeName,
    stops: stops.map((group) => ({
      id: group.stop.id,
      name: group.stop.name,
      kind: group.stop.kind,
      order: group.stop.order,
      lat: group.stop.lat,
      lng: group.stop.lng,
      boarded_count: group.events.filter((e) => e.event_type === "in").length,
      events: group.events.map((e) => ({
        id: e.id,
        student_name: e.student_name,
        event_type: e.event_type,
        scanned_at: e.scanned_at,
        distance_m:
          e.distance_m != null ? Math.round(e.distance_m) : null,
      })),
    })),
  });
}
