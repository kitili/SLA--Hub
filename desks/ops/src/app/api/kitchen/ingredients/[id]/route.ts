import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import {
  updateKitchenIngredient,
  type KitchenCalcMethod,
  type KitchenIngredientCategory,
} from "@/lib/db/kitchen";

type Ctx = { params: Promise<{ id: string }> };

const KITCHEN_ROLES: Role[] = ["admin", "finance", "ops_manager", "finance_manager", "cfo"];

/**
 * PATCH /api/kitchen/ingredients/:id — admin/finance/kitchen roles
 * Body: { name?, unit?, category?, calcMethod?, peoplePerKg?, kgPerWeek?, defaultUnitPrice?, active? }
 */
export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const body = (await request.json()) as {
    name?: string;
    unit?: string;
    category?: KitchenIngredientCategory;
    calcMethod?: KitchenCalcMethod;
    peoplePerKg?: number | null;
    kgPerWeek?: number | null;
    defaultUnitPrice?: number;
    active?: boolean;
  };

  const outcome = await updateKitchenIngredient(id, body);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome);
}
