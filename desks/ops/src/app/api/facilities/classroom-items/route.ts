import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { FACILITIES_ROLES } from "@/lib/facilities-access";
import { createClassroomItem, listClassroomItems } from "@/lib/db/facilities";

/** GET/POST /api/facilities/classroom-items */
export async function GET(request: Request) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const items = await listClassroomItems({
    schoolId: searchParams.get("schoolId") ?? undefined,
  });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    schoolId?: string;
    grade?: string;
    itemName?: string;
    quantity?: number;
    remarks?: string;
  };

  if (!body.itemName?.trim()) {
    return NextResponse.json({ error: "itemName is required" }, { status: 400 });
  }

  const outcome = await createClassroomItem({
    schoolId: body.schoolId,
    grade: body.grade,
    itemName: body.itemName,
    quantity: body.quantity,
    remarks: body.remarks,
    createdBy: auth.userId,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ item: outcome.item }, { status: 201 });
}
