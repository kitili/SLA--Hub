import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { createServiceClient } from "@/lib/supabase/admin";
import { runClusterStopsFromTrips } from "@/lib/stops/cluster-from-trips";

/**
 * POST /api/admin/cluster-stops
 * Body: { apply?: boolean, radiusM?: number, busId?, routeId?, schoolId? }
 * Dry-run unless apply=true. Admin only.
 */
export async function POST(request: Request) {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  let body: {
    apply?: boolean;
    radiusM?: number;
    busId?: string;
    routeId?: string;
    schoolId?: string;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    const supabase = createServiceClient();
    const result = await runClusterStopsFromTrips({
      supabase,
      apply: Boolean(body.apply),
      radiusM: body.radiusM,
      busId: body.busId,
      routeId: body.routeId,
      schoolId: body.schoolId,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cluster failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
