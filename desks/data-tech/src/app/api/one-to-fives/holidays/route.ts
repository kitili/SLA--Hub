import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { oneToFiveHolidays } from "@/db/schema";
import { requireModule, requireSession } from "@/lib/rbac";
import { listHolidays } from "@/lib/one-to-fives";
import { holidaySchema } from "@/lib/validation/one-to-fives";

export async function GET() {
  const { response } = await requireSession();
  if (response) return response;
  return NextResponse.json({ holidays: await listHolidays() });
}

export async function POST(req: NextRequest) {
  const { response } = await requireModule("one_to_fives", "manage");
  if (response) return response;

  const parsed = holidaySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [holiday] = await db
    .insert(oneToFiveHolidays)
    .values({ holidayDate: parsed.data.holidayDate, name: parsed.data.name })
    .onConflictDoNothing()
    .returning();
  if (!holiday) {
    return NextResponse.json({ error: "That holiday is already marked." }, { status: 409 });
  }
  return NextResponse.json({ holiday }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { response } = await requireModule("one_to_fives", "manage");
  if (response) return response;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await db.delete(oneToFiveHolidays).where(eq(oneToFiveHolidays.id, id));
  return NextResponse.json({ ok: true });
}
