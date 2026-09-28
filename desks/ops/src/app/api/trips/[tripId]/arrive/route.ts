import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { assertDriverCanUseTrip } from "@/lib/driver/access";
import { markTripArrived } from "@/lib/db/queries";

type Ctx = { params: Promise<{ tripId: string }> };

/**
 * POST /api/trips/[tripId]/arrive — matron/driver marks the bus as having
 * arrived at school. Manually entered, not GPS-derived (see
 * schema_week2.sql's actual_arrival_at comment for why).
 * Body: { arrivedAt? } — ISO timestamp, defaults to now().
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

  let arrivedAt: string | null = null;
  try {
    const body = (await request.json()) as { arrivedAt?: string | null };
    if (body.arrivedAt) arrivedAt = body.arrivedAt;
  } catch {
    // empty body ok — defaults to now()
  }

  const outcome = await markTripArrived({ tripId, arrivedAt });

  if ("error" in outcome) {
    const status = outcome.code === "not_found" ? 404 : 400;
    return NextResponse.json(
      { error: outcome.error, code: outcome.code },
      { status },
    );
  }

  return NextResponse.json({ trip: outcome.trip });
}
