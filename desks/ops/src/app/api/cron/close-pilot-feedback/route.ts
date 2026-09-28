import { NextResponse } from "next/server";
import { markOpenPilotFeedbackDone } from "@/lib/db/pilot-feedback";

/**
 * GET|POST /api/cron/close-pilot-feedback
 * After a production ship: mark remaining open / in-progress pilot feedback as done.
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const outcome = await markOpenPilotFeedbackDone(null);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    closed: outcome.feedback.length,
    feedback: outcome.feedback,
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
