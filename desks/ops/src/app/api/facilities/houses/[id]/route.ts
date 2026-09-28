import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { FACILITIES_ROLES } from "@/lib/facilities-access";
import { deleteHouse, updateHouse, type FurnitureStatus } from "@/lib/db/facilities";

const FURNITURE_STATUSES: FurnitureStatus[] = ["furnished", "unfurnished"];

/** PATCH /api/facilities/houses/:id */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const body = (await request.json()) as {
    schoolId?: string | null;
    houseLetter?: string | null;
    houseName?: string;
    roomsDescription?: string | null;
    furnitureStatus?: FurnitureStatus;
    notes?: string | null;
  };
  if (body.furnitureStatus && !FURNITURE_STATUSES.includes(body.furnitureStatus)) {
    return NextResponse.json({ error: "invalid furnitureStatus" }, { status: 400 });
  }

  const outcome = await updateHouse(id, body);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ house: outcome.house });
}

/** DELETE /api/facilities/houses/:id */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const outcome = await deleteHouse(id);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
