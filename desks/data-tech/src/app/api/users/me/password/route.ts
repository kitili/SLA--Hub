import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireSession } from "@/lib/rbac";
import { changeOwnPasswordSchema } from "@/lib/validation/user";

export async function POST(req: NextRequest) {
  const { session, response } = await requireSession();
  if (response) return response;

  const parsed = changeOwnPasswordSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);

  await db
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: false,
      tokenVersion: sql`${users.tokenVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  // The current request's JWT still has the old tokenVersion, so the client should
  // sign out and back in — the session callback will reject the stale token on the next check.
  return NextResponse.json({ ok: true });
}
