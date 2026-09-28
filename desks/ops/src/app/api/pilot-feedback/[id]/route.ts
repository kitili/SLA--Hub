import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { updatePilotFeedbackStatus, type FeedbackStatus } from "@/lib/db/pilot-feedback";

const STATUSES: FeedbackStatus[] = ["open", "in_progress", "done"];

/** PATCH /api/pilot-feedback/:id — admin only, updates status */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(["admin"]);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const body = (await request.json()) as { status?: FeedbackStatus };
  if (!body.status || !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const outcome = await updatePilotFeedbackStatus(id, body.status, auth.userId);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ feedback: outcome.feedback });
}
