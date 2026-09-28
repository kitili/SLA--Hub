import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { assertDriverCanUseBus } from "@/lib/driver/access";
import { createTrip, forceCloseStaleTrip, getTrips } from "@/lib/db/queries";
import type { TripDirection } from "@/types/database";

export async function GET(request: Request) {
  const auth = await requireUser(["admin", "transport", "matron", "driver", "finance"]);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? undefined;
  const trips = await getTrips(date ?? undefined);
  return NextResponse.json({ trips });
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "transport", "matron", "driver"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    busId?: string;
    direction?: TripDirection;
    tripDate?: string;
    matronId?: string;
    closeStaleId?: string;
  };

  if (!body.busId || !body.direction) {
    return NextResponse.json(
      { error: "busId and direction (am|pm) are required" },
      { status: 400 },
    );
  }

  if (body.direction !== "am" && body.direction !== "pm") {
    return NextResponse.json(
      { error: "direction must be 'am' or 'pm'" },
      { status: 400 },
    );
  }

  const access = await assertDriverCanUseBus(auth.supabase, {
    userId: auth.userId,
    role: auth.role,
    busId: body.busId,
  });
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  if (body.closeStaleId) {
    const closed = await forceCloseStaleTrip({
      tripId: body.closeStaleId,
      closedBy: auth.userId,
    });
    if (!closed.ok) {
      return NextResponse.json({ error: closed.error }, { status: 400 });
    }
  }

  const result = await createTrip({
    busId: body.busId,
    direction: body.direction,
    tripDate: body.tripDate,
    matronId: body.matronId ?? auth.userId,
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error, code: result.code, staleTripId: result.staleTripId },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { trip: result.trip, resumedExisting: result.resumedExisting ?? false },
    { status: result.resumedExisting ? 200 : 201 },
  );
}
