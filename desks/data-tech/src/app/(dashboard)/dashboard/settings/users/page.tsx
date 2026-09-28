import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users, departments, userModules } from "@/db/schema";
import { UsersManager } from "@/components/settings/users-manager";
import { hasModuleAccess, type ModuleKey, type AccessLevel } from "@/lib/modules";

export default async function UsersPage() {
  const session = await auth();
  const isAdmin = session?.user.role === "admin";
  if (!isAdmin && !hasModuleAccess(session?.user.modules ?? {}, "users")) redirect("/dashboard");

  const [rows, depts, moduleRows] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        departmentId: users.departmentId,
        isActive: users.isActive,
      })
      .from(users)
      .orderBy(asc(users.name)),
    db.select().from(departments).orderBy(asc(departments.name)),
    db.select({ userId: userModules.userId, module: userModules.module, level: userModules.level }).from(userModules),
  ]);

  const modulesByUser = new Map<string, Partial<Record<ModuleKey, AccessLevel>>>();
  for (const row of moduleRows) {
    const entry = modulesByUser.get(row.userId) ?? {};
    entry[row.module] = row.level;
    modulesByUser.set(row.userId, entry);
  }

  const usersWithModules = rows.map((u) => ({ ...u, modules: modulesByUser.get(u.id) ?? {} }));
  const canManage = isAdmin || hasModuleAccess(session!.user.modules, "users", "manage");

  return <UsersManager users={usersWithModules} departments={depts} canManage={canManage} />;
}
