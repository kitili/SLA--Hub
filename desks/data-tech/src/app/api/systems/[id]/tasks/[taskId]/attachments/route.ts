import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { systemTaskAttachments, systemTasks } from "@/db/schema";
import { requireModule } from "@/lib/rbac";
import { getSystemAndPermissions } from "@/lib/systems";
import { uploadTaskAttachment, UploadValidationError } from "@/lib/blob";
import { loadTaskDetail, logTaskActivity } from "@/lib/task-workspace";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { session, response } = await requireModule("systems", "view");
  if (response) return response;

  const { taskId } = await params;
  const [existingTask] = await db.select().from(systemTasks).where(eq(systemTasks.id, taskId)).limit(1);
  if (!existingTask) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { system, permissions } = await getSystemAndPermissions(existingTask.systemId, session.user);
  if (!system) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!permissions.canEditTask) {
    return NextResponse.json({ error: "You cannot edit this task" }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a file" }, { status: 400 });
  }

  try {
    const uploaded = await uploadTaskAttachment(file);
    await db.insert(systemTaskAttachments).values({ taskId, ...uploaded });
    await logTaskActivity(taskId, session.user.id, "attached", uploaded.filename);
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not upload the file" }, { status: 502 });
  }

  const task = await loadTaskDetail(taskId);
  return NextResponse.json({ task }, { status: 201 });
}
