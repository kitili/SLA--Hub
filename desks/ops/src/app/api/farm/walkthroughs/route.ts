import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { createWalkthrough, listWalkthroughs } from "@/lib/db/farm";

/**
 * GET  /api/farm/walkthroughs?plotId= — admin/finance
 * POST /api/farm/walkthroughs — admin/finance
 */
export async function GET(request: Request) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const plotId = new URL(request.url).searchParams.get("plotId") ?? undefined;
  const walkthroughs = await listWalkthroughs(plotId ? { plotId } : undefined);
  return NextResponse.json({ walkthroughs });
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    weekOf?: string;
    plotId?: string | null;
    checklist?: Record<string, unknown>;
    overallScore?: number | null;
    photoUrl?: string | null;
    notes?: string | null;
  };

  if (!body.weekOf?.trim()) {
    return NextResponse.json({ error: "weekOf is required" }, { status: 400 });
  }
  if (!body.checklist || typeof body.checklist !== "object") {
    return NextResponse.json({ error: "checklist is required" }, { status: 400 });
  }

  const outcome = await createWalkthrough({
    weekOf: body.weekOf.trim(),
    plotId: body.plotId || null,
    checklist: body.checklist,
    overallScore: body.overallScore ?? null,
    photoUrl: body.photoUrl?.trim() || null,
    notes: body.notes?.trim() || null,
    reviewedBy: auth.userId,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  return NextResponse.json({ walkthrough: outcome.walkthrough }, { status: 201 });
}
