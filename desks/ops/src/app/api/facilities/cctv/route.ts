import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { FACILITIES_ROLES } from "@/lib/facilities-access";
import { createCctv, listCctv } from "@/lib/db/facilities";

/** GET/POST /api/facilities/cctv */
export async function GET(request: Request) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const cameras = await listCctv({
    schoolId: searchParams.get("schoolId") ?? undefined,
  });
  return NextResponse.json({ cameras });
}

export async function POST(request: Request) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    schoolId?: string;
    cameraType?: string;
    location?: string;
    quantity?: number;
    description?: string;
  };

  if (!body.location?.trim()) {
    return NextResponse.json({ error: "location is required" }, { status: 400 });
  }

  const outcome = await createCctv({
    schoolId: body.schoolId,
    cameraType: body.cameraType,
    location: body.location,
    quantity: body.quantity,
    description: body.description,
    createdBy: auth.userId,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ camera: outcome.camera }, { status: 201 });
}
