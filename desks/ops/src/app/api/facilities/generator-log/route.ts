import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { FACILITIES_ROLES } from "@/lib/facilities-access";
import { createGeneratorLog, listGeneratorLogs } from "@/lib/db/facilities";

/** GET/POST /api/facilities/generator-log */
export async function GET(request: Request) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const logs = await listGeneratorLogs({
    schoolId: searchParams.get("schoolId") ?? undefined,
  });
  return NextResponse.json({ logs });
}

export async function POST(request: Request) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    schoolId?: string;
    task?: string;
    logDate?: string;
    score?: number;
    comments?: string;
    inspector?: string;
  };

  if (!body.task?.trim()) {
    return NextResponse.json({ error: "task is required" }, { status: 400 });
  }
  if (typeof body.score !== "number" || body.score < 1 || body.score > 5) {
    return NextResponse.json({ error: "score must be 1-5" }, { status: 400 });
  }

  const outcome = await createGeneratorLog({
    schoolId: body.schoolId,
    task: body.task,
    logDate: body.logDate,
    score: body.score,
    comments: body.comments,
    inspector: body.inspector,
    createdBy: auth.userId,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ log: outcome.log }, { status: 201 });
}
