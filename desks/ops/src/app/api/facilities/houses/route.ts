import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { FACILITIES_ROLES } from "@/lib/facilities-access";
import { createHouse, listHouses, type FurnitureStatus } from "@/lib/db/facilities";

const FURNITURE_STATUSES: FurnitureStatus[] = ["furnished", "unfurnished"];

/** GET/POST /api/facilities/houses */
export async function GET(request: Request) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const houses = await listHouses({
    schoolId: searchParams.get("schoolId") ?? undefined,
  });
  return NextResponse.json({ houses });
}

export async function POST(request: Request) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    schoolId?: string;
    houseLetter?: string;
    houseName?: string;
    roomsDescription?: string;
    furnitureStatus?: FurnitureStatus;
    notes?: string;
  };

  if (!body.houseName?.trim()) {
    return NextResponse.json({ error: "houseName is required" }, { status: 400 });
  }
  if (body.furnitureStatus && !FURNITURE_STATUSES.includes(body.furnitureStatus)) {
    return NextResponse.json({ error: "invalid furnitureStatus" }, { status: 400 });
  }

  const outcome = await createHouse({
    schoolId: body.schoolId,
    houseLetter: body.houseLetter,
    houseName: body.houseName,
    roomsDescription: body.roomsDescription,
    furnitureStatus: body.furnitureStatus,
    notes: body.notes,
    createdBy: auth.userId,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ house: outcome.house }, { status: 201 });
}
