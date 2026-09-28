import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import { getKitchenBudget, upsertKitchenBudget } from "@/lib/db/kitchen";

const KITCHEN_ROLES: Role[] = ["admin", "finance", "ops_manager", "finance_manager", "cfo"];

/** GET /api/kitchen/budget?schoolId=&month= — admin/finance/kitchen roles */
export async function GET(request: Request) {
  const auth = await requireUser(KITCHEN_ROLES);
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

  const budget = await getKitchenBudget(schoolId, month);
  return NextResponse.json({ budget });
}

/**
 * POST /api/kitchen/budget — admin/finance/kitchen roles
 * Body: { schoolId, month, budgetAmount, currency? }
 */
export async function POST(request: Request) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    schoolId?: string;
    month?: string;
    budgetAmount?: number;
    currency?: string;
  };

  if (!body.schoolId || !body.month) {
    return NextResponse.json(
      { error: "schoolId and month are required" },
      { status: 400 },
    );
  }

  const outcome = await upsertKitchenBudget({
    schoolId: body.schoolId,
    month: body.month,
    budgetAmount: body.budgetAmount ?? 0,
    currency: body.currency,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome);
}
