import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { setRouteStops } from "@/lib/db/routes";

type Ctx = { params: Promise<{ routeId: string }> };

/**
 * PUT /api/routes/[routeId]/stops — replace ordered stops (admin)
 * Body: { stops: [{ stopId, order, etaOffsetMinutes? }] }
 */
export async function PUT(request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "transport"]);
  if ("response" in auth) return auth.response;

  const { routeId } = await context.params;
  const body = (await request.json()) as {
    stops?: {
      stopId?: string;
      order?: number;
      etaOffsetMinutes?: number | null;
    }[];
  };

  if (!Array.isArray(body.stops)) {
    return NextResponse.json({ error: "stops array required" }, { status: 400 });
  }

  const stops = body.stops.map((s, i) => {
    if (!s.stopId) throw new Error("each stop needs stopId");
    return {
      stopId: s.stopId,
      order: typeof s.order === "number" ? s.order : i,
      etaOffsetMinutes: s.etaOffsetMinutes ?? null,
    };
  });

  try {
    const outcome = await setRouteStops({ routeId, stops });
    if ("error" in outcome) {
      return NextResponse.json({ error: outcome.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, count: stops.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid stops" },
      { status: 400 },
    );
  }
}
