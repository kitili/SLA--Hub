import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { FACILITIES_ROLES } from "@/lib/facilities-access";
import { deleteChecklistScore, updateChecklistScore } from "@/lib/db/facilities";

/** PATCH /api/facilities/checklist/:id */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const body = (await request.json()) as {
    schoolId?: string | null;
    area?: string;
    walkthroughDate?: string;
    score?: number;
    comments?: string | null;
    inspector?: string | null;
  };
  if (body.score !== undefined && (body.score < 1 || body.score > 5)) {
    return NextResponse.json({ error: "score must be 1-5" }, { status: 400 });
  }

  const outcome = await updateChecklistScore(id, body);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ score: outcome.score });
}

/** DELETE /api/facilities/checklist/:id */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const outcome = await deleteChecklistScore(id);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
