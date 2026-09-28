import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { adminSetPasswordSchema } from "@/lib/validation/user";
import { logAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/request";

// Admin-initiated reset (e.g. a user forgot their password and asked IT) — not a
// self-service "forgot password" email flow, which is out of scope for v1.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireModule("users", "manage");
  if (response) return response;

  const { id } = await params;
  const parsed = adminSetPasswordSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);

  const [updated] = await db
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: true,
      tokenVersion: sql`${users.tokenVersion} + 1`,
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning({ id: users.id });

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await logAudit({
    actorUserId: session.user.id,
    action: "user.password_reset_by_admin",
    targetType: "user",
    targetId: id,
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ ok: true });
}
