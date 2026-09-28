import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import { createKitchenMenuPlan, listKitchenMenuPlans, type KitchenMealSlot } from "@/lib/db/kitchen";

const KITCHEN_ROLES: Role[] = [
  "admin",
  "finance",
  "ops_manager",
  "finance_manager",
  "cfo",
  "cook",
  "head_of_kitchens",
];

/** GET /api/kitchen/menu-plans?schoolId=&start=&end= — admin/finance/kitchen roles */
export async function GET(request: Request) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const schoolId = searchParams.get("schoolId");
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!schoolId || !start || !end) {
    return NextResponse.json({ error: "schoolId, start, and end are required" }, { status: 400 });
  }

  const plans = await listKitchenMenuPlans(schoolId, start, end);
  return NextResponse.json({ plans });
}

/**
 * POST /api/kitchen/menu-plans — admin/ops/finance-manager/cfo/head-of-kitchens
 * Body: { schoolId, serveDate, mealSlot, menuItemId, notes? }
 */
export async function POST(request: Request) {
  const auth = await requireUser(["admin", "ops_manager", "finance_manager", "cfo", "head_of_kitchens"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    schoolId?: string;
    serveDate?: string;
    mealSlot?: KitchenMealSlot;
    menuItemId?: string;
    notes?: string;
  };

  if (!body.schoolId || !body.serveDate || !body.mealSlot || !body.menuItemId) {
    return NextResponse.json(
      { error: "schoolId, serveDate, mealSlot, and menuItemId are required" },
      { status: 400 },
    );
  }

  const outcome = await createKitchenMenuPlan({
    schoolId: body.schoolId,
    serveDate: body.serveDate,
    mealSlot: body.mealSlot,
    menuItemId: body.menuItemId,
    notes: body.notes?.trim() || null,
    createdBy: auth.userId,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome, { status: 201 });
}
