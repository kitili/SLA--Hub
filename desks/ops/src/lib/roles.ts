/**
 * Fixed app roles for Majundo Ops.
 * Profiles in Supabase should store one of these in `profiles.role`.
 */
export const ROLES = {
  ADMIN: "admin",
  MATRON: "matron",
  FINANCE: "finance",
  DRIVER: "driver",
  FARM: "farm",
  /** Fleet / boarding / routes only. (Baraka + Shikunzi moved to admin.) */
  TRANSPORT: "transport",
  // Read-only oversight — sees admin-area pages (incidents, alerts) but
  // cannot create/update/delete. Not yet granted read access to every
  // existing admin table (see supabase/schema_directors.sql for scope).
  DIRECTOR: "director",
  // Kitchen + Facilities + Farm department lead (Kusaduka).
  OPS_MANAGER: "ops_manager",
  FINANCE_MANAGER: "finance_manager",
  CFO: "cfo",
  // Phone/tablet, in-kitchen roles (v3) — the compliance-checklist module.
  COOK: "cook",
  HEAD_OF_KITCHENS: "head_of_kitchens",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_HOME: Record<Role, string> = {
  admin: "/ops/admin",
  matron: "/matron",
  finance: "/admin/dashboard",
  driver: "/matron",
  farm: "/admin/farm",
  transport: "/admin/dashboard",
  director: "/admin/dashboard",
  ops_manager: "/ops",
  finance_manager: "/ops/kitchen/dashboard",
  cfo: "/ops/kitchen/dashboard",
  cook: "/kitchen",
  head_of_kitchens: "/kitchen",
};

/** Roles that may use the transport admin shell (/admin, except farm-only). */
export const TRANSPORT_ADMIN_ROLES: Role[] = [
  "admin",
  "finance",
  "transport",
];

/** Roles that may manage farm live sheets. */
export const FARM_ROLES: Role[] = ["admin", "finance", "farm", "ops_manager"];

export function isRole(value: string): value is Role {
  return Object.values(ROLES).includes(value as Role);
}

/** Honor ?next= only when it matches this role's workspace. */
export function roleCanAccess(role: Role, path: string): boolean {
  if (role === "farm") {
    return path.startsWith("/admin/farm");
  }
  if (role === "transport") {
    return (
      (path.startsWith("/admin") && !path.startsWith("/admin/farm")) ||
      path.startsWith("/transport") ||
      path.startsWith("/matron")
    );
  }
  if (role === "admin" || role === "finance") {
    return (
      path.startsWith("/admin") ||
      path.startsWith("/ops") ||
      path.startsWith("/transport") ||
      path.startsWith("/matron")
    );
  }
  // Director is narrower on purpose — read-only oversight over the admin
  // area (incidents, alerts), not the full ops/transport surface.
  if (role === "director") {
    return path.startsWith("/admin");
  }
  if (role === "driver") {
    // Legacy driver logins — same unified matron field app.
    return path.startsWith("/matron");
  }
  if (role === "matron") {
    return path.startsWith("/matron");
  }
  // Ops lead: Kitchen + Facilities + Farm (+ ticketing hub).
  if (role === "ops_manager") {
    return (
      path === "/ops" ||
      path.startsWith("/ops/kitchen") ||
      path.startsWith("/ops/facilities") ||
      path.startsWith("/ops/ticketing") ||
      path.startsWith("/admin/farm") ||
      path.startsWith("/farm") ||
      path.startsWith("/kitchen")
    );
  }
  if (role === "finance_manager" || role === "cfo") {
    return (
      path === "/ops" ||
      path.startsWith("/ops/kitchen") ||
      path.startsWith("/ops/facilities")
    );
  }
  // Cooks / Head of Kitchens use the lightweight mobile-first /kitchen
  // route, not the desktop admin-style /ops/kitchen page.
  if (role === "cook" || role === "head_of_kitchens") {
    return path.startsWith("/kitchen");
  }
  return path.startsWith("/matron");
}

export function resolveRole(
  profileRole: string | null | undefined,
  metaRole: unknown,
): Role | null {
  if (profileRole && isRole(profileRole)) return profileRole;
  if (typeof metaRole === "string" && isRole(metaRole)) return metaRole;
  return null;
}
