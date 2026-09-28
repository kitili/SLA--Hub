import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import { listKitchenIngredientNutrition, upsertKitchenIngredientNutrition } from "@/lib/db/kitchen";

const KITCHEN_ROLES: Role[] = [
  "admin",
  "finance",
  "ops_manager",
  "finance_manager",
  "cfo",
  "cook",
  "head_of_kitchens",
];

/** GET /api/kitchen/ingredient-nutrition — admin/finance/kitchen roles */
export async function GET() {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const byIngredient = await listKitchenIngredientNutrition();
  return NextResponse.json({ byIngredient });
}

/**
 * POST /api/kitchen/ingredient-nutrition — admin/ops/finance-manager/cfo only
 * Body: { ingredientId, caloriesPer100g?, proteinG?, carbsG?, fatG?, fiberG?, notes? }
 */
export async function POST(request: Request) {
  const auth = await requireUser(["admin", "ops_manager", "finance_manager", "cfo"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    ingredientId?: string;
    caloriesPer100g?: number;
    proteinG?: number;
    carbsG?: number;
    fatG?: number;
    fiberG?: number;
    notes?: string;
  };

  if (!body.ingredientId) {
    return NextResponse.json({ error: "ingredientId is required" }, { status: 400 });
  }

  // All values are per 100g of the ingredient, so they're physically bounded:
  // no nutrient can weigh more than the 100g it's measured in, and pure fat
  // (the most calorie-dense case) tops out around 900 kcal/100g.
  const macros: Array<[string, number | undefined]> = [
    ["proteinG", body.proteinG],
    ["carbsG", body.carbsG],
    ["fatG", body.fatG],
    ["fiberG", body.fiberG],
  ];
  for (const [field, value] of macros) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 100)) {
      return NextResponse.json({ error: `${field} must be between 0 and 100` }, { status: 400 });
    }
  }
  if (
    body.caloriesPer100g !== undefined &&
    (!Number.isFinite(body.caloriesPer100g) || body.caloriesPer100g < 0 || body.caloriesPer100g > 900)
  ) {
    return NextResponse.json({ error: "caloriesPer100g must be between 0 and 900" }, { status: 400 });
  }

  const outcome = await upsertKitchenIngredientNutrition({
    ingredientId: body.ingredientId,
    caloriesPer100g: body.caloriesPer100g ?? null,
    proteinG: body.proteinG ?? null,
    carbsG: body.carbsG ?? null,
    fatG: body.fatG ?? null,
    fiberG: body.fiberG ?? null,
    notes: body.notes?.trim() || null,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome);
}
