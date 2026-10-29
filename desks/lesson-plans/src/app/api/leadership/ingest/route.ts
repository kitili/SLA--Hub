/**
 * POST /api/leadership/ingest
 *
 * Receives the dashboard payload from the Instructional Leadership Apps
 * Script (pushToHub) and replaces the stored snapshot in the Academics
 * database. Authenticated by `Authorization: Bearer ILD_INGEST_KEY`; checked
 * before the body is read. Bodies over MAX_INGEST_BYTES are refused.
 *
 * Response: { ok: true, walkthroughs, observations }
 */
import { NextResponse } from "next/server";

import { checkIngestAuth } from "@/lib/leadership/access";
import { MAX_INGEST_BYTES, parseLeadershipPayload } from "@/lib/leadership/schema";
import { leadershipSql, replaceLeadershipSnapshot } from "@/lib/leadership/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<NextResponse> {
  const auth = checkIngestAuth(request.headers.get("authorization"));
  if (auth === "unconfigured") {
    return NextResponse.json({ error: "Leadership ingest is not configured" }, { status: 503, headers: NO_STORE });
  }
  if (auth === "denied") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_INGEST_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413, headers: NO_STORE });
  }
  const text = await request.text();
  if (text.length > MAX_INGEST_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: NO_STORE });
  }

  const parsed = parseLeadershipPayload(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.issues }, { status: 422, headers: NO_STORE });
  }

  const sql = leadershipSql();
  if (!sql) {
    return NextResponse.json({ error: "The shared database is not configured" }, { status: 503, headers: NO_STORE });
  }

  try {
    const stored = await replaceLeadershipSnapshot(sql, parsed.data);
    return NextResponse.json({ ok: true, ...stored }, { headers: NO_STORE });
  } catch (error) {
    console.error("[leadership-ingest]", error instanceof Error ? error.name : "error");
    return NextResponse.json({ error: "The shared database did not respond" }, { status: 502, headers: NO_STORE });
  }
}
