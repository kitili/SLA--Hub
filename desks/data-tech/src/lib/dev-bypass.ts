import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { Session } from "next-auth";

export function isDevAuthBypassEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_BYPASS === "1";
}

export async function loadDevBypassSession(): Promise<Session | null> {
  if (!isDevAuthBypassEnabled()) return null;

  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase().trim();
  if (!email) return null;

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !user.isActive) return null;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      mustChangePassword: false,
      modules: {},
    },
    expires: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
  };
}
