import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { createStop, listStops } from "@/lib/db/routes";
import type { StopKind } from "@/types/database";

const KINDS: StopKind[] = ["school", "pickup", "dropoff", "waypoint"];

/**
 * GET  /api/stops?schoolId=
 * POST /api/stops — admin create
 */
export async function GET(request: Request) {
  const auth = await requireUser(["admin", "transport", "matron", "driver", "finance"]);
  if ("response" in auth) return auth.response;

  const schoolId = new URL(request.url).searchParams.get("schoolId") ?? undefined;
  const stops = await listStops(schoolId);
  return NextResponse.json({ stops });
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    schoolId?: string;
    name?: string;
    lat?: number | null;
    lng?: number | null;
    kind?: StopKind;
  };

  if (!body.schoolId?.trim() || !body.name?.trim()) {
    return NextResponse.json(
      { error: "schoolId and name are required" },
      { status: 400 },
    );
  }

  if (body.kind && !KINDS.includes(body.kind)) {
    return NextResponse.json({ error: "invalid kind" }, { status: 400 });
  }

  const outcome = await createStop({
    schoolId: body.schoolId.trim(),
    name: body.name.trim(),
    lat: body.lat,
    lng: body.lng,
    kind: body.kind,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  return NextResponse.json({ stop: outcome.stop }, { status: 201 });
}
