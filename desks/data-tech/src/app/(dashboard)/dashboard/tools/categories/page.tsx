import { asc } from "drizzle-orm";
import { db } from "@/db";
import { toolCategories } from "@/db/schema";
import { requireModulePage } from "@/lib/require-module-page";
import { CategoryCreateList } from "@/components/tools/category-create-list";

export default async function ToolCategoriesPage() {
  const { canManage } = await requireModulePage("tech_tools", "view");
  const categories = await db.select().from(toolCategories).orderBy(asc(toolCategories.name));
  return <CategoryCreateList items={categories} canManage={canManage} />;
}
