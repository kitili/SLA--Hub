import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import {
  createKitchenIngredient,
  listKitchenIngredients,
  type KitchenCalcMethod,
  type KitchenIngredientCategory,
} from "@/lib/db/kitchen";

const KITCHEN_ROLES: Role[] = ["admin", "finance", "ops_manager", "finance_manager", "cfo"];

/** GET /api/kitchen/ingredients — admin/finance/kitchen roles */
export async function GET() {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const ingredients = await listKitchenIngredients();
  return NextResponse.json({ ingredients });
}

/**
 * POST /api/kitchen/ingredients — admin/finance/kitchen roles
 * Body: { name, unit, category, calcMethod, peoplePerKg?, kgPerWeek?, defaultUnitPrice }
 */
export async function POST(request: Request) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    name?: string;
    unit?: string;
    category?: KitchenIngredientCategory;
    calcMethod?: KitchenCalcMethod;
    peoplePerKg?: number | null;
    kgPerWeek?: number | null;
    defaultUnitPrice?: number;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const outcome = await createKitchenIngredient({
    name: body.name.trim(),
    unit: body.unit?.trim() || "kg",
    category: body.category ?? "grain",
    calcMethod: body.calcMethod ?? "headcount_ratio",
    peoplePerKg: body.peoplePerKg ?? null,
    kgPerWeek: body.kgPerWeek ?? null,
    defaultUnitPrice: body.defaultUnitPrice ?? 0,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome, { status: 201 });
}
