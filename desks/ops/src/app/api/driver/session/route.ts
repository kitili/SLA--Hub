import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { getDriverSession } from "@/lib/driver/session";

/** GET /api/driver/session — assigned buses + driver link for the signed-in user. */
export async function GET() {
  const auth = await requireUser(["driver", "admin", "transport"]);
  if ("response" in auth) return auth.response;

  try {
    const session = await getDriverSession(auth.userId);
    return NextResponse.json({
      driver_id: session.driverId,
      driver_name: session.driverName,
      assigned_buses: session.assignedBuses,
      fleet_count: session.allBuses.length,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Could not load driver session",
        driver_id: null,
        assigned_buses: [],
        fleet_count: 0,
      },
      { status: 500 },
    );
  }
}
