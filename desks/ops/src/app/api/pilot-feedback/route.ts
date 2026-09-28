import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import {
  createPilotFeedback,
  listAllPilotFeedback,
  listMyPilotFeedback,
  markOpenPilotFeedbackDone,
  type FeedbackStatus,
} from "@/lib/db/pilot-feedback";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/pilot-feedback — ?mine=1 for the caller's own submissions,
 * otherwise every submission (admin only).
 * POST /api/pilot-feedback — any logged-in user can submit.
 */
export async function GET(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  if (searchParams.get("mine") === "1") {
    const feedback = await listMyPilotFeedback(auth.userId);
    return NextResponse.json({ feedback });
  }

  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const feedback = await listAllPilotFeedback({
    department: searchParams.get("department") ?? undefined,
    status: (searchParams.get("status") as FeedbackStatus | null) ?? undefined,
  });
  return NextResponse.json({ feedback });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    department?: string;
    pagePath?: string;
    message?: string;
  };
  if (!body.department?.trim() || !body.pagePath?.trim() || !body.message?.trim()) {
    return NextResponse.json(
      { error: "department, pagePath, and message are required" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", auth.userId)
    .maybeSingle();
  const label = (profile?.full_name as string | null)?.trim() || auth.role || "Unknown";

  const outcome = await createPilotFeedback({
    submittedBy: auth.userId,
    submittedByLabel: label,
    department: body.department.trim(),
    pagePath: body.pagePath.trim(),
    message: body.message,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ feedback: outcome.feedback }, { status: 201 });
}

/** PATCH /api/pilot-feedback — admin only. `{ status: "done", scope: "open" }` closes every open item after a ship. */
export async function PATCH(request: Request) {
  const auth = await requireUser(["admin"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as { status?: FeedbackStatus; scope?: string };
  if (body.status !== "done" || body.scope !== "open") {
    return NextResponse.json(
      { error: "Use { status: \"done\", scope: \"open\" } to close remaining items" },
      { status: 400 },
    );
  }

  const outcome = await markOpenPilotFeedbackDone(auth.userId);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ closed: outcome.feedback.length, feedback: outcome.feedback });
}
