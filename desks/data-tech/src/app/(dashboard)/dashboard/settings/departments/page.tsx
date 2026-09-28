import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { departments } from "@/db/schema";
import { SimpleCreateList } from "@/components/tools/simple-create-list";
import { hasModuleAccess } from "@/lib/modules";

export default async function DepartmentsPage() {
  const session = await auth();
  const isAdmin = session?.user.role === "admin";
  if (!isAdmin && !hasModuleAccess(session?.user.modules ?? {}, "departments")) redirect("/dashboard");

  const canManage = isAdmin || hasModuleAccess(session!.user.modules, "departments", "manage");
  const rows = await db.select().from(departments).orderBy(asc(departments.name));
  return <SimpleCreateList title="Departments" apiPath="/api/departments" items={rows} canManage={canManage} />;
}
