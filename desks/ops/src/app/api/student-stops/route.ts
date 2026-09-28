import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import {
  assignStudentToCoordinate,
  listStudentStopAssignments,
} from "@/lib/db/routes";
import { isPlausibleTanzaniaCoord } from "@/lib/geo/plausible-coord";

/**
 * GET  /api/student-stops?routeId=
 * POST /api/student-stops — assign student to stop (admin)
 */
export async function GET(request: Request) {
  const auth = await requireUser(["admin", "transport", "matron", "driver", "finance"]);
  if ("response" in auth) return auth.response;

  const routeId = new URL(request.url).searchParams.get("routeId") ?? undefined;
  const assignments = await listStudentStopAssignments(routeId);
  return NextResponse.json({ assignments });
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    studentId?: string;
    routeId?: string;
    schoolId?: string;
    lat?: number;
    lng?: number;
    stopName?: string;
  };

  if (
    !body.studentId?.trim() ||
    !body.routeId?.trim() ||
    !body.schoolId?.trim() ||
    typeof body.lat !== "number" ||
    !Number.isFinite(body.lat) ||
    typeof body.lng !== "number" ||
    !Number.isFinite(body.lng)
  ) {
    return NextResponse.json(
      { error: "studentId, routeId, schoolId, lat and lng are required" },
      { status: 400 },
    );
  }

  // A finite number is not the same as a real coordinate -- a digit typo or
  // a swapped lat/lng still passes Number.isFinite. Reject anything outside
  // Tanzania outright rather than silently storing it (this is exactly how
  // at least one confirmed-garbage stop got into the live data before).
  if (!isPlausibleTanzaniaCoord(body.lat, body.lng)) {
    return NextResponse.json(
      { error: `lat/lng (${body.lat}, ${body.lng}) is not within Tanzania — check for a typo` },
      { status: 400 },
    );
  }

  const outcome = await assignStudentToCoordinate({
    studentId: body.studentId.trim(),
    routeId: body.routeId.trim(),
    schoolId: body.schoolId.trim(),
    lat: body.lat,
    lng: body.lng,
    stopName: body.stopName?.trim() || undefined,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
