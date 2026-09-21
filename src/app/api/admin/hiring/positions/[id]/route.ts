import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { jobOpenings } from "@/lib/db/schema";
import { requireAdminApi } from "@/lib/hiring/require-admin-api";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body.status !== "string") {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }

  const [updated] = await db
    .update(jobOpenings)
    .set({ status: body.status, updatedAt: new Date() })
    .where(eq(jobOpenings.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ position: { id: updated.id, title: updated.title, status: updated.status } });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await db.delete(jobOpenings).where(eq(jobOpenings.id, id));

  return NextResponse.json({ ok: true });
}
