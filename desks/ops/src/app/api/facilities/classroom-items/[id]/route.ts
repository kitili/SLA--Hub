import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { FACILITIES_ROLES } from "@/lib/facilities-access";
import { deleteClassroomItem, updateClassroomItem } from "@/lib/db/facilities";

/** PATCH /api/facilities/classroom-items/:id */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const body = (await request.json()) as {
    schoolId?: string | null;
    grade?: string | null;
    itemName?: string;
    quantity?: number | null;
    remarks?: string | null;
  };

  const outcome = await updateClassroomItem(id, body);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ item: outcome.item });
}

/** DELETE /api/facilities/classroom-items/:id */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const outcome = await deleteClassroomItem(id);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
