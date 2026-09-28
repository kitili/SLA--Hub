import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { toolReminderDates } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { createToolReminderSchema } from "@/lib/validation/tool-reminder";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireModule("tech_tools", "manage");
  if (response) return response;

  const { id: toolId } = await params;
  const parsed = createToolReminderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [reminder] = await db
    .insert(toolReminderDates)
    .values({ toolId, label: parsed.data.label, date: parsed.data.date })
    .returning();

  return NextResponse.json({ reminder }, { status: 201 });
}
