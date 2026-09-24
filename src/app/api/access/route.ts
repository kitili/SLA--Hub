import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordDeskOpen } from "@/lib/access";
import { getDepartment } from "@/lib/departments";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let departmentId = "";
  try {
    const body = (await request.json()) as { departmentId?: string };
    departmentId = body.departmentId?.trim() ?? "";
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const department = getDepartment(departmentId);
  if (!department) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await recordDeskOpen(department.id, "hub-click");
  return NextResponse.json({ ok: true });
}
