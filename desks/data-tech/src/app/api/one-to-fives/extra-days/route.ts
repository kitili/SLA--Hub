import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { oneToFiveExtraDays } from "@/db/schema";
import { requireModule, requireSession } from "@/lib/rbac";
import { listExtraDays } from "@/lib/one-to-fives";
import { extraDaySchema } from "@/lib/validation/one-to-fives";

export async function GET() {
  const { response } = await requireSession();
  if (response) return response;
  return NextResponse.json({ extraDays: await listExtraDays() });
}

export async function POST(req: NextRequest) {
  const { response } = await requireModule("one_to_fives", "manage");
  if (response) return response;

  const parsed = extraDaySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [day] = await db
    .insert(oneToFiveExtraDays)
    .values({ workDate: parsed.data.workDate, reason: parsed.data.reason || null })
    .onConflictDoNothing()
    .returning();
  if (!day) {
    return NextResponse.json({ error: "That extra day is already marked." }, { status: 409 });
  }
  return NextResponse.json({ extraDay: day }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { response } = await requireModule("one_to_fives", "manage");
  if (response) return response;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await db.delete(oneToFiveExtraDays).where(eq(oneToFiveExtraDays.id, id));
  return NextResponse.json({ ok: true });
}
