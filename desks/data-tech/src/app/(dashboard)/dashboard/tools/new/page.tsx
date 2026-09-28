import { asc } from "drizzle-orm";
import { db } from "@/db";
import { toolCategories } from "@/db/schema";
import { requireModulePage } from "@/lib/require-module-page";
import { NewToolForm } from "@/components/tools/new-tool-form";

export default async function NewToolPage() {
  await requireModulePage("tech_tools", "manage");
  const categories = await db.select().from(toolCategories).orderBy(asc(toolCategories.name));

  return (
    <div>
      <h1 className="mb-6 text-xl font-medium text-navy">Add tool</h1>
      <NewToolForm categories={categories} />
    </div>
  );
}
