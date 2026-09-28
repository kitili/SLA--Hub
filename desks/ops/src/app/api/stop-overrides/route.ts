import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { createClient } from "@/lib/supabase/server";

/**
 * GET  /api/stop-overrides?routeId=&onDate=YYYY-MM-DD
 * POST /api/stop-overrides — create a temporary parent location change
 */
export async function GET(request: Request) {
  const auth = await requireUser(["admin", "transport", "matron", "driver"]);
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const routeId = url.searchParams.get("routeId");
  const onDate =
    url.searchParams.get("onDate") ?? new Date().toISOString().slice(0, 10);

  const supabase = await createClient();
  let q = supabase
    .from("student_stop_temporary_overrides")
    .select(
      "id, student_id, route_id, original_stop_id, override_lat, override_lng, override_name, starts_on, ends_on, reason, created_at",
    )
    .lte("starts_on", onDate)
    .gte("ends_on", onDate)
    .order("starts_on", { ascending: false });

  if (routeId) q = q.eq("route_id", routeId);

  const { data, error } = await q;
  if (error) {
    const missing = /student_stop_temporary_overrides|schema cache|PGRST/i.test(
      error.message,
    );
    return NextResponse.json(
      {
        error: error.message,
        ...(missing
          ? {
              hint: "Run supabase/migrate_temp_stops_and_route_logs.sql in Supabase SQL Editor.",
              setup: "migrate_temp_stops_and_route_logs.sql",
            }
          : {}),
      },
      { status: missing ? 503 : 400 },
    );
  }

  return NextResponse.json({ overrides: data ?? [], on_date: onDate });
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    studentId?: string;
    routeId?: string;
    originalStopId?: string;
    lat?: number;
    lng?: number;
    name?: string;
    startsOn?: string;
    endsOn?: string;
    reason?: string;
  };

  if (
    !body.studentId?.trim() ||
    !body.routeId?.trim() ||
    !body.originalStopId?.trim() ||
    body.lat == null ||
    body.lng == null ||
    !body.startsOn ||
    !body.endsOn
  ) {
    return NextResponse.json(
      {
        error:
          "studentId, routeId, originalStopId, lat, lng, startsOn, endsOn are required",
      },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_stop_temporary_overrides")
    .insert({
      student_id: body.studentId.trim(),
      route_id: body.routeId.trim(),
      original_stop_id: body.originalStopId.trim(),
      override_lat: body.lat,
      override_lng: body.lng,
      override_name: body.name?.trim() || null,
      starts_on: body.startsOn,
      ends_on: body.endsOn,
      reason: body.reason?.trim() || null,
      created_by: auth.userId,
    })
    .select(
      "id, student_id, route_id, original_stop_id, override_lat, override_lng, override_name, starts_on, ends_on, reason, created_at",
    )
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not create override" },
      { status: 400 },
    );
  }

  void supabase.from("route_change_logs").insert({
    route_id: body.routeId.trim(),
    event_type: "override",
    summary: `Temporary stop override ${body.startsOn} → ${body.endsOn}`,
    actor_id: auth.userId,
    meta: {
      student_id: body.studentId,
      original_stop_id: body.originalStopId,
      lat: body.lat,
      lng: body.lng,
    },
  });

  return NextResponse.json({ override: data }, { status: 201 });
}
