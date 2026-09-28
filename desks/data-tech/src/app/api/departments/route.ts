import { NextRequest, NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { departments } from "@/db/schema";
import { requireModule, requireSession } from "@/lib/rbac";
import { createDepartmentSchema } from "@/lib/validation/user";

// Reference data used by other modules (e.g. the tool allocation form's "Department"
// option) — stays open to any authenticated user rather than gated behind the
// Departments module, which is specifically about the manage/create page.
export async function GET() {
  const { response } = await requireSession();
  if (response) return response;

  const rows = await db.select().from(departments).orderBy(asc(departments.name));
  return NextResponse.json({ departments: rows });
}

export async function POST(req: NextRequest) {
  const { response } = await requireModule("departments", "manage");
  if (response) return response;

  const parsed = createDepartmentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [department] = await db.insert(departments).values(parsed.data).returning();
  return NextResponse.json({ department }, { status: 201 });
}
