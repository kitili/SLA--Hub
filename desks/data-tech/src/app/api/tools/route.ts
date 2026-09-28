import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { tools } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { createToolSchema } from "@/lib/validation/tool";

export async function GET() {
  const { response } = await requireModule("tech_tools", "view");
  if (response) return response;

  const rows = await db.query.tools.findMany({
    orderBy: desc(tools.createdAt),
    with: { category: true, location: true },
    limit: 500,
  });

  return NextResponse.json({ tools: rows });
}

export async function POST(req: NextRequest) {
  const { response } = await requireModule("tech_tools", "manage");
  if (response) return response;

  const parsed = createToolSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [tool] = await db.insert(tools).values(parsed.data).returning();
  return NextResponse.json({ tool }, { status: 201 });
}
