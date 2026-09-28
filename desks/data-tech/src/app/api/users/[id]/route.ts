import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, userModules } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { updateUserSchema } from "@/lib/validation/user";
import { applyModuleAssignments, ensureDataTechStaffAccess } from "@/lib/user-modules";
import { logAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/request";

const PUBLIC_USER_COLUMNS = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  departmentId: users.departmentId,
  isActive: users.isActive,
  mustChangePassword: users.mustChangePassword,
  createdAt: users.createdAt,
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireModule("users", "view");
  if (response) return response;

  const { id } = await params;
  const [user] = await db.select(PUBLIC_USER_COLUMNS).from(users).where(eq(users.id, id)).limit(1);
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const moduleRows = await db
    .select({ module: userModules.module, level: userModules.level })
    .from(userModules)
    .where(eq(userModules.userId, id));
  const modules = Object.fromEntries(moduleRows.map((r) => [r.module, r.level]));

  return NextResponse.json({ user: { ...user, modules } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireModule("users", "manage");
  if (response) return response;

  const { id } = await params;
  const parsed = updateUserSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { modules, isAdmin, ...rest } = parsed.data;

  // Deactivating/role-changing a user invalidates their existing sessions immediately.
  // Module changes don't need this — the session callback re-reads them on every request.
  const bumpToken = rest.isActive === false || isAdmin !== undefined;

  const updated = await db.transaction(async (tx) => {
    const [updatedUser] = await tx
      .update(users)
      .set({
        ...rest,
        ...(isAdmin !== undefined ? { role: isAdmin ? "admin" : "tech" } : {}),
        ...(bumpToken ? { tokenVersion: sql`${users.tokenVersion} + 1` } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning(PUBLIC_USER_COLUMNS);

    if (updatedUser && isAdmin !== true) {
      await applyModuleAssignments(tx, id, modules);
      await ensureDataTechStaffAccess(tx, id, updatedUser.departmentId);
    }

    return updatedUser;
  });

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await logAudit({
    actorUserId: session.user.id,
    action: "user.update",
    targetType: "user",
    targetId: id,
    metadata: { ...rest, isAdmin, modules },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ user: updated });
}
