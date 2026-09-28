import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { assertDriverCanUseTrip } from "@/lib/driver/access";
import { markTripDepartedSchool } from "@/lib/db/queries";

type Ctx = { params: Promise<{ tripId: string }> };

/**
 * POST /api/trips/[tripId]/depart — matron marks bus left school
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

  let lat: number | null = null;
  let lng: number | null = null;
  try {
    const body = (await request.json()) as {
      lat?: number | null;
      lng?: number | null;
    };
    if (typeof body.lat === "number" && Number.isFinite(body.lat)) lat = body.lat;
    if (typeof body.lng === "number" && Number.isFinite(body.lng)) lng = body.lng;
  } catch {
    // empty body ok
  }

  const outcome = await markTripDepartedSchool({
    tripId,
    matronId: auth.userId,
    lat,
    lng,
  });

  if ("error" in outcome) {
    const status = outcome.code === "not_found" ? 404 : 400;
    return NextResponse.json(
      { error: outcome.error, code: outcome.code },
      { status },
    );
  }

  return NextResponse.json({ trip: outcome.trip });
}
