import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { deleteWalkthrough, updateWalkthrough } from "@/lib/db/farm";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const body = (await request.json()) as {
    weekOf?: string;
    plotId?: string | null;
    checklist?: Record<string, unknown>;
    overallScore?: number | null;
    photoUrl?: string | null;
    notes?: string | null;
  };

  const outcome = await updateWalkthrough(id, body);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ walkthrough: outcome.walkthrough });
}

export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const outcome = await deleteWalkthrough(id);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
