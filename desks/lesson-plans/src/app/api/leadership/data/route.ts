/**
 * GET /api/leadership/data
 *
 * The stored Instructional Leadership snapshot, as JSON for the dashboard.
 * Admin-only and never cached. `?refresh=1` is accepted for the Refresh
 * button; the data is already live from the database, so it changes nothing.
 */
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { canViewLeadership } from "@/lib/leadership/access";
import { loadLeadershipSnapshot } from "@/lib/leadership/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401, headers: NO_STORE });
  if (!canViewLeadership(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  }

  try {
    const loaded = await loadLeadershipSnapshot();
    if (!loaded) return NextResponse.json({ empty: true }, { headers: NO_STORE });
    return NextResponse.json(
      { ...loaded.data, snapshot: true, source: loaded.source },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error("[leadership]", error instanceof Error ? error.name : "error");
    return NextResponse.json({ error: "The shared database did not respond" }, { status: 502, headers: NO_STORE });
  }
}
