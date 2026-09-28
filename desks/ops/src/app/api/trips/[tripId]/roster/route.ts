import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { countAboard, getTripById, getTripRoster } from "@/lib/db/queries";

type Params = { params: Promise<{ tripId: string }> };

/**
 * GET /api/trips/[tripId]/roster
 * Who is currently aboard + headcount for the live trip.
 */
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireUser(["admin", "transport", "matron", "driver", "finance"]);
  if ("response" in auth) return auth.response;

  const { tripId } = await params;
  if (!tripId) {
    return NextResponse.json({ error: "tripId required" }, { status: 400 });
  }

  const trip = await getTripById(tripId);
  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const [aboard, roster] = await Promise.all([
    countAboard(tripId),
    getTripRoster(tripId),
  ]);

  return NextResponse.json({
    trip: {
      id: trip.id,
      direction: trip.direction,
      status: trip.status,
      bus_label: trip.bus_label,
      capacity: trip.bus_capacity ?? null,
    },
    aboard_count: aboard,
    students: roster,
  });
}
