import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { FACILITIES_ROLES } from "@/lib/facilities-access";
import { createHouseOccupancy, listHouseOccupancy } from "@/lib/db/facilities";

/** GET/POST /api/facilities/house-occupancy */
export async function GET(request: Request) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const entries = await listHouseOccupancy({
    houseId: searchParams.get("houseId") ?? undefined,
  });
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    houseId?: string;
    periodStart?: string;
    periodEnd?: string;
    occupant?: string;
    notes?: string;
  };

  if (!body.houseId) {
    return NextResponse.json({ error: "houseId is required" }, { status: 400 });
  }
  if (!body.periodStart || !body.periodEnd) {
    return NextResponse.json({ error: "periodStart and periodEnd are required" }, { status: 400 });
  }
  if (!body.occupant?.trim()) {
    return NextResponse.json({ error: "occupant is required" }, { status: 400 });
  }

  const outcome = await createHouseOccupancy({
    houseId: body.houseId,
    periodStart: body.periodStart,
    periodEnd: body.periodEnd,
    occupant: body.occupant,
    notes: body.notes,
    createdBy: auth.userId,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ occupancy: outcome.occupancy }, { status: 201 });
}
