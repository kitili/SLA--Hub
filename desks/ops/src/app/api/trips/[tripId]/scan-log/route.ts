import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { listBoardingEventsForTrip } from "@/lib/db/queries";

type Ctx = { params: Promise<{ tripId: string }> };

/**
 * GET /api/trips/[tripId]/scan-log — flat, chronological boarding events
 * for this trip, each with its resolved location (nearest stop + raw
 * coordinates). Replaces the old stop-grouped view for the matron's live
 * panel -- that view silently dropped any scan it couldn't match to a
 * stop, undercounting who'd actually boarded.
 */
export async function GET(_request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "transport", "matron", "driver", "finance"]);
  if ("response" in auth) return auth.response;

  const { tripId } = await context.params;
  if (!tripId) {
    return NextResponse.json({ error: "tripId required" }, { status: 400 });
  }

  const scans = await listBoardingEventsForTrip(tripId);
  return NextResponse.json({ scans });
}
