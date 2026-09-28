import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import { listKitchenInventoryCounts, upsertKitchenInventoryCount } from "@/lib/db/kitchen";

const KITCHEN_ROLES: Role[] = [
  "admin",
  "finance",
  "ops_manager",
  "finance_manager",
  "cfo",
  "cook",
  "head_of_kitchens",
];

/** GET /api/kitchen/inventory?schoolId=&start=&end= — admin/finance/kitchen roles */
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

  const counts = await listKitchenInventoryCounts(schoolId, start, end);
  return NextResponse.json({ counts });
}

/**
 * POST /api/kitchen/inventory — any kitchen role (cooks can log a stock count)
 * Body: { schoolId, ingredientId, countedOn, quantityOnHand, notes? }
 * Upserts one row per school/ingredient/count-date.
 */
export async function POST(request: Request) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    schoolId?: string;
    ingredientId?: string;
    countedOn?: string;
    quantityOnHand?: number;
    notes?: string;
  };

  if (!body.schoolId || !body.ingredientId || !body.countedOn || body.quantityOnHand === undefined) {
    return NextResponse.json(
      { error: "schoolId, ingredientId, countedOn, and quantityOnHand are required" },
      { status: 400 },
    );
  }

  const outcome = await upsertKitchenInventoryCount({
    schoolId: body.schoolId,
    ingredientId: body.ingredientId,
    countedOn: body.countedOn,
    quantityOnHand: body.quantityOnHand,
    notes: body.notes?.trim() || null,
    createdBy: auth.userId,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome, { status: 201 });
}
