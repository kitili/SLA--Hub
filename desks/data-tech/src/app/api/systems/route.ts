import { NextRequest, NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { systems } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { createSystemSchema } from "@/lib/validation/system";
import { isUniqueViolation } from "@/lib/db-errors";
import { SAFE_USER_COLUMNS } from "@/lib/safe-columns";
import { notifySystemLead } from "@/lib/systems";

export async function GET() {
  const { response } = await requireModule("systems", "view");
  if (response) return response;

  const rows = await db.query.systems.findMany({
    orderBy: asc(systems.name),
    with: { lead: { columns: SAFE_USER_COLUMNS } },
  });
  return NextResponse.json({ systems: rows });
}

export async function POST(req: NextRequest) {
  const { response } = await requireModule("systems", "manage");
  if (response) return response;

  const parsed = createSystemSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const [system] = await db
      .insert(systems)
      .values({
        name: parsed.data.name,
        description: parsed.data.description,
        features: parsed.data.features ?? [],
        techStack: parsed.data.techStack ?? [],
        url: parsed.data.url,
        status: parsed.data.status,
        leadId: parsed.data.leadId,
        departmentId: parsed.data.departmentId,
        state: parsed.data.state,
        startDate: parsed.data.startDate,
        targetDate: parsed.data.targetDate,
      })
      .returning();

    if (system.leadId) {
      await notifySystemLead({ leadId: system.leadId, systemId: system.id, systemName: system.name, description: system.description });
    }

    return NextResponse.json({ system }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "A system with this name already exists" }, { status: 409 });
    }
    throw error;
  }
}
