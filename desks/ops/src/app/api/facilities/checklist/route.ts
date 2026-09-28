import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { FACILITIES_ROLES } from "@/lib/facilities-access";
import { createChecklistScore, listChecklistScores } from "@/lib/db/facilities";

/** GET/POST /api/facilities/checklist */
export async function GET(request: Request) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const scores = await listChecklistScores({
    schoolId: searchParams.get("schoolId") ?? undefined,
  });
  return NextResponse.json({ scores });
}

export async function POST(request: Request) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    schoolId?: string;
    area?: string;
    walkthroughDate?: string;
    score?: number;
    comments?: string;
    inspector?: string;
  };

  if (!body.area?.trim()) {
    return NextResponse.json({ error: "area is required" }, { status: 400 });
  }
  if (typeof body.score !== "number" || body.score < 1 || body.score > 5) {
    return NextResponse.json({ error: "score must be 1-5" }, { status: 400 });
  }

  const outcome = await createChecklistScore({
    schoolId: body.schoolId,
    area: body.area,
    walkthroughDate: body.walkthroughDate,
    score: body.score,
    comments: body.comments,
    inspector: body.inspector,
    createdBy: auth.userId,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ score: outcome.score }, { status: 201 });
}
