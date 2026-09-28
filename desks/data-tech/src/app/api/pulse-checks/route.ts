import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/rbac";
import { nairobiDateString, latestThursday } from "@/lib/nairobi";
import { expectedPulseDepartments, loadBoard, submitPulse } from "@/lib/one-to-fives";
import { submitPulseSchema } from "@/lib/validation/one-to-fives";

export async function GET(req: NextRequest) {
  const { session, response } = await requireSession();
  if (response || !session) return response;

  const date = req.nextUrl.searchParams.get("date") ?? nairobiDateString();
  const weekThursday = latestThursday(date);
  const canManage = session.user.role === "admin" || session.user.modules.one_to_fives === "manage";
  const board = await loadBoard(date);
  return NextResponse.json({
    weekThursday,
    departments: board.departments,
    pulses: board.pulses,
    allDepartments: await expectedPulseDepartments(),
    canManage,
  });
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireSession();
  if (response || !session) return response;

  const parsed = submitPulseSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const canManage = session.user.role === "admin" || session.user.modules.one_to_fives === "manage";
  const result = await submitPulse({
    userId: session.user.id,
    canManage,
    userDepartmentId: session.user.departmentId,
    ...parsed.data,
  });
  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
