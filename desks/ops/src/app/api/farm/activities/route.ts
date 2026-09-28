import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import {
  createActivity,
  listActivities,
  type ActivityStatus,
  type ActivityType,
} from "@/lib/db/farm";

const ACTIVITY_TYPES: ActivityType[] = [
  "prep",
  "plant",
  "weed",
  "inspect",
  "fertilize",
  "irrigate",
  "harvest",
  "other",
];

const STATUSES: ActivityStatus[] = [
  "pending",
  "in_progress",
  "done",
  "skipped",
];

/**
 * GET  /api/farm/activities?plotId=&status= — admin/finance
 * POST /api/farm/activities — admin/finance
 */
export async function GET(request: Request) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const plotId = url.searchParams.get("plotId") ?? undefined;
  const statusParam = url.searchParams.get("status") ?? undefined;
  const status =
    statusParam && STATUSES.includes(statusParam as ActivityStatus)
      ? (statusParam as ActivityStatus)
      : undefined;

  const activities = await listActivities({ plotId, status });
  return NextResponse.json({ activities });
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    plotId?: string | null;
    plantingId?: string | null;
    activityType?: ActivityType;
    title?: string;
    dueOn?: string | null;
    assignee?: string | null;
    notes?: string | null;
  };

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  if (body.activityType && !ACTIVITY_TYPES.includes(body.activityType)) {
    return NextResponse.json({ error: "invalid activityType" }, { status: 400 });
  }

  const outcome = await createActivity({
    plotId: body.plotId ?? null,
    plantingId: body.plantingId ?? null,
    activityType: body.activityType ?? "other",
    title: body.title.trim(),
    dueOn: body.dueOn ?? null,
    assignee: body.assignee ?? null,
    notes: body.notes ?? null,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  return NextResponse.json({ activity: outcome.activity }, { status: 201 });
}
