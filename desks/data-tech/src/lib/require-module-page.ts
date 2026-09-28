import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasModuleAccess, type ModuleKey, type AccessLevel } from "@/lib/modules";

// For Server Component pages (not API routes — see requireModule in rbac.ts for those).
// Redirects to /login if not authenticated, or to `redirectTo` if the user lacks at least
// `minLevel` access to `module`. Returns canManage so pages can conditionally render
// admin/manage-only controls without a second lookup.
export async function requireModulePage(module: ModuleKey, minLevel: AccessLevel = "view", redirectTo = "/dashboard") {
  const session = await auth();
  if (!session?.user || session.error === "SessionRevoked") {
    redirect("/login");
  }

  const isAdmin = session.user.role === "admin";
  if (!isAdmin && !hasModuleAccess(session.user.modules, module, minLevel)) {
    redirect(redirectTo);
  }

  const canManage = isAdmin || hasModuleAccess(session.user.modules, module, "manage");
  return { session, isAdmin, canManage };
}

// 1–5s are company-wide: every logged-in person in every department can open the page.
export async function requireLoginPage(manageModule?: ModuleKey) {
  const session = await auth();
  if (!session?.user || session.error === "SessionRevoked") {
    redirect("/login");
  }

  const isAdmin = session.user.role === "admin";
  const canManage =
    isAdmin || (manageModule ? hasModuleAccess(session.user.modules, manageModule, "manage") : false);
  return { session, isAdmin, canManage };
}
