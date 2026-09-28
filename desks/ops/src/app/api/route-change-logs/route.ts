import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { createClient } from "@/lib/supabase/server";

/**
 * GET  /api/route-change-logs?routeId=&limit=
 * POST /api/route-change-logs — log a newly discovered / edited route
 */
export async function GET(request: Request) {
  const auth = await requireUser(["admin", "transport", "matron", "driver"]);
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const routeId = url.searchParams.get("routeId");
  const limit = Math.min(
    Number(url.searchParams.get("limit")) || 50,
    200,
  );

  const supabase = await createClient();
  let q = supabase
    .from("route_change_logs")
    .select(
      "id, route_id, event_type, summary, before_stop_ids, after_stop_ids, distance_km_before, distance_km_after, meta, actor_id, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (routeId) q = q.eq("route_id", routeId);

  const { data, error } = await q;
  if (error) {
    const missing = /route_change_logs|schema cache|PGRST/i.test(error.message);
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

  return NextResponse.json({ logs: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "transport", "driver", "matron"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    routeId?: string | null;
    eventType?: string;
    summary?: string;
    beforeStopIds?: string[];
    afterStopIds?: string[];
    distanceKmBefore?: number | null;
    distanceKmAfter?: number | null;
    meta?: Record<string, unknown>;
  };

  const eventType = (body.eventType ?? "discovered").trim();
  const summary = (body.summary ?? "").trim();
  if (!summary) {
    return NextResponse.json({ error: "summary is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("route_change_logs")
    .insert({
      route_id: body.routeId?.trim() || null,
      event_type: eventType,
      summary,
      before_stop_ids: body.beforeStopIds ?? null,
      after_stop_ids: body.afterStopIds ?? null,
      distance_km_before: body.distanceKmBefore ?? null,
      distance_km_after: body.distanceKmAfter ?? null,
      meta: body.meta ?? {},
      actor_id: auth.userId,
    })
    .select(
      "id, route_id, event_type, summary, before_stop_ids, after_stop_ids, distance_km_before, distance_km_after, meta, actor_id, created_at",
    )
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not write log" },
      { status: 400 },
    );
  }

  return NextResponse.json({ log: data }, { status: 201 });
}
