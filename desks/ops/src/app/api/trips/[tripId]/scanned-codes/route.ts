import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { getScannedQrCodesForTrip, getTripById } from "@/lib/db/queries";

type Params = { params: Promise<{ tripId: string }> };

/** GET /api/trips/[tripId]/scanned-codes — QR codes already boarded this trip. */
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

  const codes = await getScannedQrCodesForTrip(tripId);
  return NextResponse.json({ codes });
}
