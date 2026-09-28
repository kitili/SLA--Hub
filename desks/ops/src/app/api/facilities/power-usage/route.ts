import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { FACILITIES_ROLES } from "@/lib/facilities-access";
import { createPowerUsage, listPowerUsage } from "@/lib/db/facilities";

/** GET/POST /api/facilities/power-usage */
export async function GET(request: Request) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const entries = await listPowerUsage({
    schoolId: searchParams.get("schoolId") ?? undefined,
  });
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    schoolId?: string;
    readingDate?: string;
    unitsReceived?: number;
    unitsSpent?: number;
    balanceUnits?: number;
  };

  const outcome = await createPowerUsage({
    schoolId: body.schoolId,
    readingDate: body.readingDate,
    unitsReceived: body.unitsReceived,
    unitsSpent: body.unitsSpent,
    balanceUnits: body.balanceUnits,
    createdBy: auth.userId,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ entry: outcome.entry }, { status: 201 });
}
