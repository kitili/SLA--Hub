import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { assertDriverCanUseTrip } from "@/lib/driver/access";
import {
  getLatestTripLocation,
  getTripLocationTrail,
  insertTripLocation,
} from "@/lib/db/queries";
import { normalizeGpsTrail } from "@/lib/geo/gps-trail";
import { checkAndNotifyApproachingStops } from "@/lib/messaging/notify-approaching";

type Ctx = { params: Promise<{ tripId: string }> };

/**
 * POST /api/trips/[tripId]/locations — matron live GPS ping (every 15–30s)
 * GET  /api/trips/[tripId]/locations?latest=1 — latest ping for map/debug
 */
export async function POST(request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "transport", "matron", "driver"]);
  if ("response" in auth) return auth.response;

  const { tripId } = await context.params;
  if (!tripId) {
    return NextResponse.json({ error: "tripId required" }, { status: 400 });
  }

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

  const body = (await request.json()) as {
    lat?: number;
    lng?: number;
    accuracy?: number | null;
    speed?: number | null;
    heading?: number | null;
  };

  if (
    typeof body.lat !== "number" ||
    typeof body.lng !== "number" ||
    !Number.isFinite(body.lat) ||
    !Number.isFinite(body.lng)
  ) {
    return NextResponse.json(
      { error: "lat and lng are required numbers" },
      { status: 400 },
    );
  }

  const outcome = await insertTripLocation({
    tripId,
    lat: body.lat,
    lng: body.lng,
    accuracy:
      typeof body.accuracy === "number" && Number.isFinite(body.accuracy)
        ? body.accuracy
        : null,
    speed:
      typeof body.speed === "number" && Number.isFinite(body.speed)
        ? body.speed
        : null,
    heading:
      typeof body.heading === "number" && Number.isFinite(body.heading)
        ? body.heading
        : null,
    recordedBy: auth.userId,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  // Best-effort — a proximity-alert failure should never fail the GPS ping.
  try {
    await checkAndNotifyApproachingStops({
      tripId,
      lat: body.lat,
      lng: body.lng,
      createdBy: auth.userId,
    });
  } catch (err) {
    console.error(
      "[approach-alert] proximity check failed:",
      err instanceof Error ? err.message : err,
    );
  }

  return NextResponse.json({ location: outcome.location }, { status: 201 });
}

export async function GET(request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "transport", "matron", "driver", "finance"]);
  if ("response" in auth) return auth.response;

  const { tripId } = await context.params;
  const { searchParams } = new URL(request.url);
  const latest = searchParams.get("latest") === "1";

  if (latest) {
    const location = await getLatestTripLocation(tripId);
    return NextResponse.json({ location });
  }

  const raw = await getTripLocationTrail(tripId);
  const trail = normalizeGpsTrail(raw);
  return NextResponse.json({
    trail,
    ping_count: raw.length,
  });
}
