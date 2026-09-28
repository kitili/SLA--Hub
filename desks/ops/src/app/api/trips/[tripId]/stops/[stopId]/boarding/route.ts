import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { getBoardingNearStop } from "@/lib/db/queries";

type Ctx = { params: Promise<{ tripId: string; stopId: string }> };

function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/**
 * GET /api/trips/[tripId]/stops/[stopId]/boarding
 * Students who boarded/alighted within ~300m of this stop's coordinates —
 * boarding_events aren't tagged with a stop_id, only the scan's own GPS fix.
 */
export async function GET(_request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "transport", "matron", "driver", "finance"]);
  if ("response" in auth) return auth.response;

  const { tripId, stopId } = await context.params;
  const { stop, events } = await getBoardingNearStop(tripId, stopId);

  if (!stop) {
    return NextResponse.json({ error: "Stop not found" }, { status: 404 });
  }

  return NextResponse.json({
    stop: {
      id: stop.id,
      name: stop.name,
      lat: stop.lat,
      lng: stop.lng,
      map_url: mapsUrl(stop.lat, stop.lng),
    },
    events: events.map((e) => ({
      id: e.id,
      student_name: e.student_name,
      event_type: e.event_type,
      scanned_at: e.scanned_at,
      lat: e.lat,
      lng: e.lng,
      distance_m: e.distance_m != null ? Math.round(e.distance_m) : null,
      map_url: e.lat != null && e.lng != null ? mapsUrl(e.lat, e.lng) : null,
    })),
  });
}
