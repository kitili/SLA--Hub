import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { tools, departments, toolLocations } from "@/db/schema";
import { requireModulePage } from "@/lib/require-module-page";
import { AllocateForm } from "@/components/tools/allocate-form";

export default async function AllocateToolsPage() {
  await requireModulePage("tech_tools", "manage");
  const [availableTools, depts, locations] = await Promise.all([
    db
      .select({ id: tools.id, assetTag: tools.assetTag, name: tools.name })
      .from(tools)
      .where(eq(tools.status, "available"))
      .orderBy(asc(tools.assetTag)),
    db.select().from(departments).orderBy(asc(departments.name)),
    db.select().from(toolLocations).orderBy(asc(toolLocations.name)),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-xl font-medium text-navy">Distribute tools</h1>
      <AllocateForm tools={availableTools} departments={depts} locations={locations} />
    </div>
  );
}
