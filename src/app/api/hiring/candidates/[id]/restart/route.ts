import { NextResponse } from "next/server";

import {
  hiringErrorResponse,
  invalidIdResponse,
} from "@/lib/hiring/http";
import { parseUuidParam } from "@/lib/hiring/ids";
import { restartCandidate, type RestartStage } from "@/lib/hiring/pipeline";
import { requireAdminApi } from "@/lib/hiring/require-admin-api";

const VALID_STAGES = new Set<RestartStage>([
  "new",
  "culture_video_submitted",
  "performance_task_submitted",
  "online_interview_requested",
]);

export async function POST(
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
  const stage = body?.stage as RestartStage | undefined;

  if (!stage || !VALID_STAGES.has(stage)) {
    return NextResponse.json({ error: "Invalid restart stage" }, { status: 400 });
  }

  try {
    const candidate = await restartCandidate(id, stage, admin.id);
    return NextResponse.json({ ok: true, candidate });
  } catch (err) {
    return hiringErrorResponse(err, "Could not restart journey");
  }
}
