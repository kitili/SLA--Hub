import { NextRequest, NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { supportContacts } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { createSupportContactSchema } from "@/lib/validation/user";

export async function GET() {
  const { response } = await requireModule("support_contacts", "view");
  if (response) return response;

  const rows = await db.select().from(supportContacts).orderBy(asc(supportContacts.sortOrder));
  return NextResponse.json({ contacts: rows });
}

export async function POST(req: NextRequest) {
  const { response } = await requireModule("support_contacts", "manage");
  if (response) return response;

  const parsed = createSupportContactSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [contact] = await db.insert(supportContacts).values(parsed.data).returning();
  return NextResponse.json({ contact }, { status: 201 });
}
