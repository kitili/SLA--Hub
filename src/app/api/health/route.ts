/**
 * GET /api/health
 *
 * Liveness probe. Always returns HTTP 200 so load-balancers / uptime monitors
 * can reach it. The `database` flag tells you whether the Drizzle/PGlite
 * connection is reachable at the time of the request.
 *
 * Response shape: { status: "ok"; database: boolean }
 * Intentionally omits directory probes and any secret-bearing config.
 */
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  let database = false;

  try {
    await db.execute(sql`select 1`);
    database = true;
  } catch {
    // Intentionally swallowed: health route reports status but never fails.
  }

  return NextResponse.json({ status: "ok", database });
}
