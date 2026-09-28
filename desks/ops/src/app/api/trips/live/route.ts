import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { getLiveBuses } from "@/lib/db/live";

/**
 * GET /api/trips/live — active buses + latest GPS (admin live map / Irene widget)
 */
export async function GET() {
  const auth = await requireUser(["admin", "transport", "finance", "matron", "driver"]);
  if ("response" in auth) return auth.response;

  const buses = await getLiveBuses();
  const online = buses.filter((b) => b.online).length;
  const gpsStale = buses.filter((b) => b.gps_stale).length;

  return NextResponse.json({
    buses,
    summary: {
      active_trips: buses.length,
      online,
      offline: buses.length - online,
      gps_stale: gpsStale,
    },
    realtime: {
      table: "trip_locations",
      channel_hint:
        "supabase.channel('trip_locations').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trip_locations' }, handler)",
    },
  });
}
