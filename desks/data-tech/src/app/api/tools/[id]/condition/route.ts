import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tools, toolConditions } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { recordConditionSchema } from "@/lib/validation/tool";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireModule("tech_tools", "view");
  if (response) return response;

  const { id: toolId } = await params;
  const parsed = recordConditionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [tool] = await db.select({ id: tools.id }).from(tools).where(eq(tools.id, toolId)).limit(1);
  if (!tool) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [condition] = await db
    .insert(toolConditions)
    .values({
      toolId,
      condition: parsed.data.condition,
      note: parsed.data.note,
      recordedBy: session.user.id,
    })
    .returning();

  await db
    .update(tools)
    .set({ currentCondition: parsed.data.condition, updatedAt: new Date() })
    .where(eq(tools.id, toolId));

  return NextResponse.json({ condition }, { status: 201 });
}
