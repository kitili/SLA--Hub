import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { deleteStop, updateStop } from "@/lib/db/routes";
import type { StopKind } from "@/types/database";

type Ctx = { params: Promise<{ stopId: string }> };

/**
 * PATCH /api/stops/[stopId] — admin
 */
export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  const { stopId } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    lat?: number | null;
    lng?: number | null;
    kind?: StopKind;
  };

  const outcome = await updateStop(stopId, body);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  return NextResponse.json({ stop: outcome.stop });
}

/**
 * DELETE /api/stops/:id — admin
 * Cascades route_stops + student stop assignments via FK.
 */
export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  const { stopId } = await context.params;
  if (!stopId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const outcome = await deleteStop(stopId);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
