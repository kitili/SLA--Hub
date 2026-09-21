import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { hiringPerformanceTasks } from "@/lib/db/schema/hiring";
import { createPerformanceTaskSchema } from "@/lib/hiring/admin-schemas";
import { hiringErrorResponse } from "@/lib/hiring/http";
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

export async function GET() {
  const admin = await requireAdminApi();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await db
    .select({
      id: hiringPerformanceTasks.id,
      title: hiringPerformanceTasks.title,
      description: hiringPerformanceTasks.description,
      fileLink: hiringPerformanceTasks.fileLink,
      managerEmail: hiringPerformanceTasks.managerEmail,
      isActive: hiringPerformanceTasks.isActive,
    })
    .from(hiringPerformanceTasks)
    .orderBy(desc(hiringPerformanceTasks.createdAt));

  return NextResponse.json(tasks.map(publicTask));
}

export async function POST(request: Request) {
  const admin = await requireAdminApi();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createPerformanceTaskSchema.safeParse(body);
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

  try {
    const [task] = await db
      .insert(hiringPerformanceTasks)
      .values({
        title: data.title!,
        description: data.description ?? null,
        fileLink: data.fileLink ?? null,
        managerEmail: data.managerEmail ?? null,
        isActive: data.isActive === undefined ? true : Boolean(data.isActive),
      })
      .returning();

    if (!task) {
      return hiringErrorResponse(new Error("insert failed"), "Could not create task", 500);
    }

    return NextResponse.json(publicTask(task), { status: 201 });
  } catch (err) {
    return hiringErrorResponse(err, "Could not create task", 500);
  }
}
