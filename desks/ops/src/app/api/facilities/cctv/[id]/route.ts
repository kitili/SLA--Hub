import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { FACILITIES_ROLES } from "@/lib/facilities-access";
import { deleteCctv, updateCctv } from "@/lib/db/facilities";

/** PATCH /api/facilities/cctv/:id */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const body = (await request.json()) as {
    schoolId?: string | null;
    cameraType?: string | null;
    location?: string;
    quantity?: number;
    description?: string | null;
  };

  const outcome = await updateCctv(id, body);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ camera: outcome.camera });
}

/** DELETE /api/facilities/cctv/:id */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const outcome = await deleteCctv(id);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
