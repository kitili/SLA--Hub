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
import { familyRegisterError, getFamilySql } from "@/lib/parent-portal/db";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  let database = false;

  try {
    await db.execute(sql`select 1`);
    database = true;
  } catch {
    // Intentionally swallowed: health route reports status but never fails.
  }

  let family = false;
  try {
    const register = getFamilySql();
    if (register) {
      await register`select 1 from public.parents limit 1`;
      family = true;
    }
  } catch (error) {
    console.error("[parents] family register unreachable:", familyRegisterError(error));
  }

  return NextResponse.json({ status: "ok", database, family });
}
