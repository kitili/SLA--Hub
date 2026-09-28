import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { getSchoolToday } from "@/lib/date/schoolDate";
import {
  getStudentPickupDetails,
  moveStudentPickupPermanently,
} from "@/lib/db/routes";
import { isPlausibleTanzaniaCoord } from "@/lib/geo/plausible-coord";

/** GET /api/students/:id/pickup — current pickup, temporary pickup, campus routes */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(["admin"]);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const details = await getStudentPickupDetails(id, getSchoolToday());
  if ("error" in details) {
    return NextResponse.json({ error: details.error }, { status: 400 });
  }
  return NextResponse.json(details);
}

/** POST /api/students/:id/pickup — permanently move the student's pickup point */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(["admin"]);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const body = (await request.json()) as {
    routeId?: string;
    lat?: number;
    lng?: number;
    stopName?: string;
    fromOverrideId?: string;
  };

  if (
    !body.routeId?.trim() ||
    typeof body.lat !== "number" ||
    !Number.isFinite(body.lat) ||
    typeof body.lng !== "number" ||
    !Number.isFinite(body.lng)
  ) {
    return NextResponse.json(
      { error: "routeId, lat and lng are required" },
      { status: 400 },
    );
  }

  // Same guard as /api/student-stops: a finite number isn't a real coordinate.
  if (!isPlausibleTanzaniaCoord(body.lat, body.lng)) {
    return NextResponse.json(
      { error: `lat/lng (${body.lat}, ${body.lng}) is not within Tanzania — check for a typo` },
      { status: 400 },
    );
  }

  const outcome = await moveStudentPickupPermanently({
    studentId: id,
    routeId: body.routeId.trim(),
    lat: body.lat,
    lng: body.lng,
    stopName: body.stopName?.trim() || undefined,
    fromOverrideId: body.fromOverrideId?.trim() || undefined,
  });
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
