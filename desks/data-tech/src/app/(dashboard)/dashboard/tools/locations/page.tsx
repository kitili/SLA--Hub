import { asc } from "drizzle-orm";
import { db } from "@/db";
import { toolLocations } from "@/db/schema";
import { requireModulePage } from "@/lib/require-module-page";
import { SimpleCreateList } from "@/components/tools/simple-create-list";

export default async function ToolLocationsPage() {
  const { canManage } = await requireModulePage("tech_tools", "view");
  const locations = await db.select().from(toolLocations).orderBy(asc(toolLocations.name));
  return <SimpleCreateList title="Tool locations" apiPath="/api/tools/locations" items={locations} canManage={canManage} />;
}
