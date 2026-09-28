import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import { listKitchenIngredientAllergens, setKitchenIngredientAllergens } from "@/lib/db/kitchen";

const KITCHEN_ROLES: Role[] = [
  "admin",
  "finance",
  "ops_manager",
  "finance_manager",
  "cfo",
  "cook",
  "head_of_kitchens",
];

/** GET /api/kitchen/ingredient-allergens — admin/finance/kitchen roles */
export async function GET() {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const byIngredient = await listKitchenIngredientAllergens();
  return NextResponse.json({ byIngredient });
}

/**
 * POST /api/kitchen/ingredient-allergens — admin/ops/finance-manager/cfo only
 * Body: { ingredientId, allergenIds: string[] } — replaces the full set for that ingredient.
 */
export async function POST(request: Request) {
  const auth = await requireUser(["admin", "ops_manager", "finance_manager", "cfo"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as { ingredientId?: string; allergenIds?: string[] };
  if (!body.ingredientId) {
    return NextResponse.json({ error: "ingredientId is required" }, { status: 400 });
  }

  const outcome = await setKitchenIngredientAllergens(body.ingredientId, body.allergenIds ?? []);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome);
}
