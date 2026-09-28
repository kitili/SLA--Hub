import "server-only";

import { getCurrentUser } from "@/lib/auth";
import type { CurrentUser } from "@/lib/contracts";
import { securityLog } from "@/lib/security/log";

/** JSON 401 for route handlers (no redirect). */
export async function requireAdminApi(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    securityLog("auth.denied", { gate: "admin-api" });
    return null;
  }
  return user;
}

/** Signed-in member (admin or not) for member-owned API routes. */
export async function requireUserApi(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user) {
    securityLog("auth.denied", { gate: "user-api" });
    return null;
  }
  return user;
}
