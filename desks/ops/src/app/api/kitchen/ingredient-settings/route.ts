import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import {
  listKitchenIngredientCampusSettings,
  upsertKitchenIngredientCampusSetting,
} from "@/lib/db/kitchen";

const KITCHEN_ROLES: Role[] = ["admin", "finance", "ops_manager", "finance_manager", "cfo"];

/** GET /api/kitchen/ingredient-settings?schoolId= — admin/finance/kitchen roles */
export async function GET(request: Request) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const schoolId = searchParams.get("schoolId");
  if (!schoolId) {
    return NextResponse.json({ error: "schoolId is required" }, { status: 400 });
  }

  const settings = await listKitchenIngredientCampusSettings(schoolId);
  return NextResponse.json({ settings });
}

/**
 * POST /api/kitchen/ingredient-settings — admin/finance/kitchen roles
 * Body: { schoolId, ingredientId, peoplePerKg?, kgPerWeek?, weeksInMonth? }
 * Per-campus override of an ingredient's calc constants — the sheet's own
 * figures genuinely differ by campus, so this intentionally does NOT
 * normalize toward one "correct" value; it stores each campus's own number.
 */
export async function POST(request: Request) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    schoolId?: string;
    ingredientId?: string;
    peoplePerKg?: number | null;
    kgPerWeek?: number | null;
    weeksInMonth?: number | null;
  };

  if (!body.schoolId || !body.ingredientId) {
    return NextResponse.json(
      { error: "schoolId and ingredientId are required" },
      { status: 400 },
    );
  }

  const outcome = await upsertKitchenIngredientCampusSetting({
    schoolId: body.schoolId,
    ingredientId: body.ingredientId,
    peoplePerKg: body.peoplePerKg ?? null,
    kgPerWeek: body.kgPerWeek ?? null,
    weeksInMonth: body.weeksInMonth ?? null,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome);
}
