import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

const bodySchema = z.object({
  fullName: z.string().trim().min(2).max(120),
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Please enter your full name (at least 2 characters)." },
      { status: 400 },
    );
  }

  await db.user.update({
    where: { id: user.id },
    data: { name: parsed.data.fullName },
  });

  return NextResponse.json({ ok: true });
}
