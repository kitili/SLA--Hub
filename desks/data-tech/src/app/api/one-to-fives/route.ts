import { NextRequest, NextResponse } from "next/server";
import { and, desc, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { oneToFives } from "@/db/schema";
import { requireSession } from "@/lib/rbac";
import { nairobiDateString } from "@/lib/nairobi";
import { loadBoard, loadMine, submitOneToFive, closeOneToFiveDay } from "@/lib/one-to-fives";
import { closeOneToFiveSchema, submitOneToFiveSchema } from "@/lib/validation/one-to-fives";

export async function GET(req: NextRequest) {
  const { session, response } = await requireSession();
  if (response || !session) return response;

  const workDate = req.nextUrl.searchParams.get("date") ?? nairobiDateString();
  const canManage = session.user.role === "admin" || session.user.modules.one_to_fives === "manage";

  if (req.nextUrl.searchParams.get("board") === "1") {
    const board = await loadBoard(workDate);
    return NextResponse.json(board);
  }

  const mine = await loadMine(session.user.id, workDate);
  if (!canManage) return NextResponse.json(mine);

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to") ?? workDate;
  const logs = await db
    .select()
    .from(oneToFives)
    .where(
      and(
        from ? gte(oneToFives.workDate, from) : undefined,
        lte(oneToFives.workDate, to),
      ),
    )
    .orderBy(desc(oneToFives.workDate));

  return NextResponse.json({ ...mine, logs });
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireSession();
  if (response || !session) return response;

  const parsed = submitOneToFiveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const canManage = session.user.role === "admin" || session.user.modules.one_to_fives === "manage";
  const result = await submitOneToFive({
    userId: session.user.id,
    canManage,
    ...parsed.data,
  });
  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}

export async function PATCH(req: NextRequest) {
  const { session, response } = await requireSession();
  if (response || !session) return response;

  const parsed = closeOneToFiveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const canManage = session.user.role === "admin" || session.user.modules.one_to_fives === "manage";
  const result = await closeOneToFiveDay({
    userId: session.user.id,
    canManage,
    ...parsed.data,
  });
  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
