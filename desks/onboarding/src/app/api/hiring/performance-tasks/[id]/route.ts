import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { hiringPerformanceTasks } from "@/lib/db/schema/hiring";
import { updatePerformanceTaskSchema } from "@/lib/hiring/admin-schemas";
import {
  hiringErrorResponse,
  invalidIdResponse,
} from "@/lib/hiring/http";
import { parseUuidParam } from "@/lib/hiring/ids";
import { requireAdminApi } from "@/lib/hiring/require-admin-api";
import { pickAllowedFields } from "@/lib/security/fields";

function publicTask(task: {
  id: string;
  title: string;
  description: string | null;
  fileLink: string | null;
  managerEmail: string | null;
  isActive: boolean;
}) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    fileLink: task.fileLink,
    managerEmail: task.managerEmail,
    isActive: task.isActive,
  };
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminApi();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseUuidParam((await context.params).id);
  if (!id) return invalidIdResponse();

  const body = await request.json().catch(() => null);
  const parsed = updatePerformanceTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid task" }, { status: 400 });
  }
  const data = pickAllowedFields(parsed.data, [
    "title",
    "description",
    "fileLink",
    "managerEmail",
    "isActive",
  ]);

  const updates: Partial<typeof hiringPerformanceTasks.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (data.title !== undefined) updates.title = data.title;
  if (data.description !== undefined) updates.description = data.description;
  if (data.fileLink !== undefined) updates.fileLink = data.fileLink;
  if (data.managerEmail !== undefined) updates.managerEmail = data.managerEmail;
  if (data.isActive !== undefined) updates.isActive = Boolean(data.isActive);

  try {
    const [updated] = await db
      .update(hiringPerformanceTasks)
      .set(updates)
      .where(eq(hiringPerformanceTasks.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(publicTask(updated));
  } catch (err) {
    return hiringErrorResponse(err, "Could not update task");
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminApi();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseUuidParam((await context.params).id);
  if (!id) return invalidIdResponse();

  await db
    .delete(hiringPerformanceTasks)
    .where(eq(hiringPerformanceTasks.id, id));

  return NextResponse.json({ ok: true });
}
