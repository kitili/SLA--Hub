import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { jobOpenings } from "@/lib/db/schema";
import { requireAdminApi } from "@/lib/hiring/require-admin-api";

export async function GET() {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const positions = await db
    .select({
      id: jobOpenings.id,
      title: jobOpenings.title,
      status: jobOpenings.status,
      createdAt: jobOpenings.createdAt,
    })
    .from(jobOpenings)
    .orderBy(jobOpenings.createdAt);

  return NextResponse.json({ positions });
}

export async function POST(request: Request) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const title = body?.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const rows = await db
    .insert(jobOpenings)
    .values({
      title,
      roleTrack: "general",
      status: "active",
      createdById: admin.id,
    })
    .returning();

  const row = rows[0];
  if (!row) return NextResponse.json({ error: "Insert failed" }, { status: 500 });

  return NextResponse.json(
    { position: { id: row.id, title: row.title, status: row.status, createdAt: row.createdAt } },
    { status: 201 },
  );
}
