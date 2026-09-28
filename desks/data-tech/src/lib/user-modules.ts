import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { departments, userModules } from "@/db/schema";
import {
  DATA_TECH_DEPARTMENT,
  DATA_TECH_STAFF_MODULES,
  withDataTechModules,
  type ModuleKey,
  type AccessLevel,
  type UserModules,
} from "@/lib/modules";

type ModuleAssignments = Partial<Record<ModuleKey, AccessLevel | null | undefined>>;
type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// A module key mapped to "view"/"manage" is upserted; mapped to null, the row is removed
// (no access); omitted entirely, left untouched. Runs against the given db/tx handle so
// callers can wrap it in the same transaction as the user insert/update.
export async function applyModuleAssignments(
  executor: DbOrTx,
  userId: string,
  modules: ModuleAssignments | undefined,
) {
  if (!modules) return;

  for (const [module, level] of Object.entries(modules) as [ModuleKey, AccessLevel | null | undefined][]) {
    if (level === undefined) continue;

    if (level === null) {
      await executor
        .delete(userModules)
        .where(and(eq(userModules.userId, userId), eq(userModules.module, module)));
      continue;
    }

    await executor
      .insert(userModules)
      .values({ userId, module, level })
      .onConflictDoUpdate({
        target: [userModules.userId, userModules.module],
        set: { level, updatedAt: new Date() },
      });
  }
}

export async function ensureDataTechStaffAccess(
  executor: DbOrTx,
  userId: string,
  departmentId: string | null | undefined,
) {
  if (!departmentId) return;
  const [dept] = await executor
    .select({ name: departments.name })
    .from(departments)
    .where(eq(departments.id, departmentId))
    .limit(1);
  if (!dept || dept.name.toLowerCase() !== DATA_TECH_DEPARTMENT.toLowerCase()) return;

  const rows = await executor
    .select({ module: userModules.module, level: userModules.level })
    .from(userModules)
    .where(eq(userModules.userId, userId));
  const current: UserModules = {};
  for (const row of rows) current[row.module] = row.level;
  const merged = withDataTechModules(current, DATA_TECH_DEPARTMENT);
  const floor: UserModules = {};
  for (const key of Object.keys(DATA_TECH_STAFF_MODULES) as ModuleKey[]) {
    const level = merged[key];
    if (level) floor[key] = level;
  }
  await applyModuleAssignments(executor, userId, floor);
}
