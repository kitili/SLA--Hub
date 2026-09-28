import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { createPlot, listPlots, type PlotStatus } from "@/lib/db/farm";

const STATUSES: PlotStatus[] = ["fallow", "staged", "active", "retired"];

/**
 * GET  /api/farm/plots — admin/finance
 * POST /api/farm/plots — admin/finance
 */
export async function GET() {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const plots = await listPlots();
  return NextResponse.json({ plots });
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    code?: string;
    name?: string | null;
    acreage?: number;
    location?: string | null;
    status?: PlotStatus;
    notes?: string | null;
  };

  if (!body.code?.trim()) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  if (body.status && !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const outcome = await createPlot({
    code: body.code,
    name: body.name ?? null,
    acreage: body.acreage,
    location: body.location ?? null,
    status: body.status,
    notes: body.notes ?? null,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  return NextResponse.json({ plot: outcome.plot }, { status: 201 });
}
