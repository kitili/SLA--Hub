import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import { getEffectiveKitchenIngredientPrices, recordKitchenIngredientPrice } from "@/lib/db/kitchen";

const KITCHEN_ROLES: Role[] = ["admin", "finance", "ops_manager", "finance_manager", "cfo"];

/** GET /api/kitchen/ingredient-prices?schoolId=&asOf= — admin/finance/kitchen roles */
export async function GET(request: Request) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const schoolId = searchParams.get("schoolId");
  const asOf = searchParams.get("asOf");
  if (!schoolId || !asOf) {
    return NextResponse.json({ error: "schoolId and asOf are required" }, { status: 400 });
  }

  const prices = await getEffectiveKitchenIngredientPrices(schoolId, asOf);
  return NextResponse.json({ prices: Object.fromEntries(prices) });
}

/**
 * POST /api/kitchen/ingredient-prices — admin/finance/kitchen roles
 * Body: { ingredientId, schoolId (null for a global price point), effectiveDate, unitPrice }
 * Records a new price point rather than overwriting one cell — this is the
 * time series the sheet's own maintainers sketched and never finished.
 */
export async function POST(request: Request) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    ingredientId?: string;
    schoolId?: string | null;
    effectiveDate?: string;
    unitPrice?: number;
  };

  if (!body.ingredientId || !body.effectiveDate || body.unitPrice === undefined) {
    return NextResponse.json(
      { error: "ingredientId, effectiveDate, and unitPrice are required" },
      { status: 400 },
    );
  }

  const outcome = await recordKitchenIngredientPrice({
    ingredientId: body.ingredientId,
    schoolId: body.schoolId ?? null,
    effectiveDate: body.effectiveDate,
    unitPrice: body.unitPrice,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome, { status: 201 });
}
