import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { updatePlot, deletePlot, type PlotStatus } from "@/lib/db/farm";

const STATUSES: PlotStatus[] = ["fallow", "staged", "active", "retired"];

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/farm/plots/:id — admin/finance
 */
export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const body = (await request.json()) as {
    name?: string | null;
    acreage?: number;
    location?: string | null;
    status?: PlotStatus;
    notes?: string | null;
  };

  if (body.status && !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const outcome = await updatePlot(id, {
    name: body.name,
    acreage: body.acreage,
    location: body.location,
    status: body.status,
    notes: body.notes,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  return NextResponse.json({ plot: outcome.plot });
}

export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const outcome = await deletePlot(id);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
