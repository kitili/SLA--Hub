import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { createUserSchema } from "@/lib/validation/user";
import { applyModuleAssignments, ensureDataTechStaffAccess } from "@/lib/user-modules";
import { logAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/request";
import { generateTempPassword } from "@/lib/temp-password";
import { sendEmail } from "@/lib/email/send-email";
import { userWelcomeEmail } from "@/lib/email/templates/user-welcome";

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

export async function GET() {
  const { response } = await requireModule("users", "view");
  if (response) return response;

  const rows = await db.select(PUBLIC_USER_COLUMNS).from(users).orderBy(asc(users.name));
  return NextResponse.json({ users: rows });
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireModule("users", "manage");
  if (response) return response;

  const parsed = createUserSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const role = parsed.data.isAdmin ? "admin" : "tech";

  const user = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({
        name: parsed.data.name,
        email,
        role,
        departmentId: parsed.data.departmentId,
        passwordHash,
        mustChangePassword: true,
      })
      .returning(PUBLIC_USER_COLUMNS);

    if (!parsed.data.isAdmin) {
      await applyModuleAssignments(tx, created.id, parsed.data.modules);
      await ensureDataTechStaffAccess(tx, created.id, parsed.data.departmentId);
    }

    return created;
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "user.create",
    targetType: "user",
    targetId: user.id,
    metadata: { email: user.email, isAdmin: parsed.data.isAdmin, modules: parsed.data.modules },
    ipAddress: getClientIp(req),
  });

  const { subject, html } = userWelcomeEmail(
    user.name,
    user.email,
    tempPassword,
    `${process.env.NEXT_PUBLIC_APP_URL}/login`,
  );
  // Awaited (not fire-and-forget) — Vercel can freeze/tear down the function's runtime
  // right after the response is sent, so an un-awaited send is not reliably delivered.
  await sendEmail({ to: user.email, subject, html }).catch(() => {});

  return NextResponse.json({ user, temporaryPassword: tempPassword }, { status: 201 });
}
