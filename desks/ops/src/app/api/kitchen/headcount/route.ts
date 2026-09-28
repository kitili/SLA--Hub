import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import { listKitchenHeadcountLines, replaceKitchenHeadcountLines } from "@/lib/db/kitchen";

const KITCHEN_ROLES: Role[] = ["admin", "finance", "ops_manager", "finance_manager", "cfo"];
const KITCHEN_READ_ROLES: Role[] = [...KITCHEN_ROLES, "cook", "head_of_kitchens"];

/** GET /api/kitchen/headcount?schoolId=&month= — admin/finance/kitchen roles
 * (read also open to cook/head_of_kitchens -- Meal Attendance's reference
 * figure needs this, same read-access shape as every other Kitchen GET). */
export async function GET(request: Request) {
  const auth = await requireUser(KITCHEN_READ_ROLES);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const schoolId = searchParams.get("schoolId");
  const month = searchParams.get("month");
  if (!schoolId || !month) {
    return NextResponse.json(
      { error: "schoolId and month are required" },
      { status: 400 },
    );
  }

  const lines = await listKitchenHeadcountLines(schoolId, month);
  return NextResponse.json({ lines });
}

/**
 * POST /api/kitchen/headcount — admin/finance/kitchen roles
 * Body: { schoolId, month, lines: [{ category, label?, headcount, daysInPeriod, pricePerPerson }] }
 * Replaces the full set of headcount lines for that school/month.
 */
export async function POST(request: Request) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    schoolId?: string;
    month?: string;
    lines?: Array<{
      category?: string;
      label?: string | null;
      headcount?: number;
      daysInPeriod?: number;
      pricePerPerson?: number;
    }>;
  };

  if (!body.schoolId || !body.month) {
    return NextResponse.json(
      { error: "schoolId and month are required" },
      { status: 400 },
    );
  }

  const lines = (body.lines ?? []).map((l) => ({
    category: l.category?.trim() || "other",
    label: l.label?.trim() || null,
    headcount: l.headcount ?? 0,
    daysInPeriod: l.daysInPeriod ?? 0,
    pricePerPerson: l.pricePerPerson ?? 0,
  }));

  const outcome = await replaceKitchenHeadcountLines(body.schoolId, body.month, lines);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome);
}
