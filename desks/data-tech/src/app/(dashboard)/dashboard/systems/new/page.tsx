import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { departments, users } from "@/db/schema";
import { requireModulePage } from "@/lib/require-module-page";
import { NewSystemForm } from "@/components/systems/new-system-form";

export default async function NewSystemPage() {
  await requireModulePage("systems", "manage");
  const [staff, deptRows] = await Promise.all([
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(asc(users.name)),
    db.select({ id: departments.id, name: departments.name }).from(departments).orderBy(asc(departments.name)),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-xl font-medium text-navy">Add a project</h1>
      <NewSystemForm staff={staff} departments={deptRows} />
    </div>
  );
}
