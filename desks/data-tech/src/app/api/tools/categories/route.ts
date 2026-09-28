import { NextRequest, NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { toolCategories } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { createToolCategorySchema } from "@/lib/validation/tool";

export async function GET() {
  const { response } = await requireModule("tech_tools", "view");
  if (response) return response;

  const categories = await db.select().from(toolCategories).orderBy(asc(toolCategories.name));
  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const { response } = await requireModule("tech_tools", "manage");
  if (response) return response;

  const parsed = createToolCategorySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [category] = await db.insert(toolCategories).values(parsed.data).returning();
  return NextResponse.json({ category }, { status: 201 });
}
