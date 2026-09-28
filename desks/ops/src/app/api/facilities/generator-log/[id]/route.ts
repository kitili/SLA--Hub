import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { FACILITIES_ROLES } from "@/lib/facilities-access";
import { deleteGeneratorLog, updateGeneratorLog } from "@/lib/db/facilities";

/** PATCH /api/facilities/generator-log/:id */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const body = (await request.json()) as {
    schoolId?: string | null;
    task?: string;
    logDate?: string;
    score?: number;
    comments?: string | null;
    inspector?: string | null;
  };
  if (body.score !== undefined && (body.score < 1 || body.score > 5)) {
    return NextResponse.json({ error: "score must be 1-5" }, { status: 400 });
  }

  const outcome = await updateGeneratorLog(id, body);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ log: outcome.log });
}

/** DELETE /api/facilities/generator-log/:id */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const outcome = await deleteGeneratorLog(id);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
