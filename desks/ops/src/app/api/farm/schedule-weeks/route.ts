import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import {
  listScheduleWeeks,
  upsertScheduleWeek,
  type FarmScheduleStage,
} from "@/lib/db/farm";

const STAGES: FarmScheduleStage[] = [
  "ON",
  "OFF",
  "FPR",
  "PLT",
  "WDN",
  "INS",
  "FTL",
  "HVT",
];

/**
 * GET  /api/farm/schedule-weeks?from=&to=
 * POST /api/farm/schedule-weeks — body: { sectionId, weekOf, stageCode, notes? }
 */
export async function GET(request: Request) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const weeks = await listScheduleWeeks({ from, to });
  return NextResponse.json({ weeks });
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    sectionId?: string;
    weekOf?: string;
    stageCode?: FarmScheduleStage;
    notes?: string | null;
  };

  if (!body.sectionId || !body.weekOf || !body.stageCode) {
    return NextResponse.json(
      { error: "sectionId, weekOf, and stageCode are required" },
      { status: 400 },
    );
  }
  if (!STAGES.includes(body.stageCode)) {
    return NextResponse.json({ error: "Invalid stageCode" }, { status: 400 });
  }

  const outcome = await upsertScheduleWeek({
    sectionId: body.sectionId,
    weekOf: body.weekOf,
    stageCode: body.stageCode,
    notes: body.notes ?? null,
  });
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome);
}
