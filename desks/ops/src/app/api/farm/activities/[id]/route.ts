import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import {
  deleteActivity,
  updateActivity,
  updateActivityStatus,
  type ActivityStatus,
  type ActivityType,
} from "@/lib/db/farm";

const STATUSES: ActivityStatus[] = [
  "pending",
  "in_progress",
  "done",
  "skipped",
];

const TYPES: ActivityType[] = [
  "prep",
  "plant",
  "weed",
  "inspect",
  "fertilize",
  "irrigate",
  "harvest",
  "other",
];

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const body = (await request.json()) as {
    status?: ActivityStatus;
    plotId?: string | null;
    plantingId?: string | null;
    activityType?: ActivityType;
    title?: string;
    dueOn?: string | null;
    assignee?: string | null;
    notes?: string | null;
  };

  if (body.status && !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  if (body.activityType && !TYPES.includes(body.activityType)) {
    return NextResponse.json({ error: "invalid activity type" }, { status: 400 });
  }

  const hasFullPatch =
    body.plotId !== undefined ||
    body.plantingId !== undefined ||
    body.activityType != null ||
    body.title != null ||
    body.dueOn !== undefined ||
    body.assignee !== undefined ||
    body.notes !== undefined;

  const outcome = hasFullPatch
    ? await updateActivity(id, body)
    : body.status
      ? await updateActivityStatus(id, body.status)
      : { error: "nothing to update" as const };

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  return NextResponse.json({ activity: outcome.activity });
}

export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const outcome = await deleteActivity(id);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
