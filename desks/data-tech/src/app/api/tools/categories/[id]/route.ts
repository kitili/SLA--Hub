import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { toolCategories } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { updateToolCategorySchema } from "@/lib/validation/tool";
import { isForeignKeyViolation } from "@/lib/db-errors";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireModule("tech_tools", "manage");
  if (response) return response;

  const { id } = await params;
  const parsed = updateToolCategorySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [updated] = await db
    .update(toolCategories)
    .set(parsed.data)
    .where(eq(toolCategories.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ category: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireModule("tech_tools", "manage");
  if (response) return response;

  const { id } = await params;

  try {
    const [deleted] = await db.delete(toolCategories).where(eq(toolCategories.id, id)).returning();
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return NextResponse.json(
        { error: "This category is still assigned to one or more devices — reassign them first" },
        { status: 409 },
      );
    }
    throw error;
  }
}
