import { NextRequest, NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { toolLocations } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { createToolLocationSchema } from "@/lib/validation/tool";

export async function GET() {
  const { response } = await requireModule("tech_tools", "view");
  if (response) return response;

  const locations = await db.select().from(toolLocations).orderBy(asc(toolLocations.name));
  return NextResponse.json({ locations });
}

export async function POST(req: NextRequest) {
  const { response } = await requireModule("tech_tools", "manage");
  if (response) return response;

  const parsed = createToolLocationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [location] = await db.insert(toolLocations).values(parsed.data).returning();
  return NextResponse.json({ location }, { status: 201 });
}
