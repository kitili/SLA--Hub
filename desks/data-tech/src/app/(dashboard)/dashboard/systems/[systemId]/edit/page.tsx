import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { departments, systems, users } from "@/db/schema";
import { requireModulePage } from "@/lib/require-module-page";
import { EditSystemForm } from "@/components/systems/edit-system-form";

export default async function EditSystemPage({ params }: { params: Promise<{ systemId: string }> }) {
  const { systemId } = await params;
  await requireModulePage("systems", "manage");

  const [system, staff, deptRows] = await Promise.all([
    db.select().from(systems).where(eq(systems.id, systemId)).limit(1).then((rows) => rows[0]),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.isActive, true)).orderBy(asc(users.name)),
    db.select({ id: departments.id, name: departments.name }).from(departments).orderBy(asc(departments.name)),
  ]);
  if (!system) notFound();

  return (
    <div>
      <h1 className="mb-6 text-xl font-medium text-navy">Edit {system.name}</h1>
      <EditSystemForm system={system} staff={staff} departments={deptRows} />
    </div>
  );
}
