import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { supportContacts } from "@/db/schema";

// Shown on the public /tickets page — intentionally unauthenticated.
export async function GET() {
  const rows = await db
    .select({
      id: supportContacts.id,
      name: supportContacts.name,
      title: supportContacts.title,
      phone: supportContacts.phone,
      email: supportContacts.email,
    })
    .from(supportContacts)
    .where(eq(supportContacts.isActive, true))
    .orderBy(asc(supportContacts.sortOrder));

  return NextResponse.json({ contacts: rows });
}
