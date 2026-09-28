import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import { createKitchenPurchase, listKitchenPurchases } from "@/lib/db/kitchen";

const KITCHEN_ROLES: Role[] = ["admin", "finance", "ops_manager", "finance_manager", "cfo"];

/** GET /api/kitchen/purchases?schoolId=&month= — admin/finance/kitchen roles */
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

  const purchases = await listKitchenPurchases(schoolId, month);
  return NextResponse.json({ purchases });
}

/**
 * POST /api/kitchen/purchases — admin/finance/kitchen roles
 * Body: { schoolId, month, ingredientId, quantity, unitPrice, purchasedOn?, notes?, vendorId? }
 */
export async function POST(request: Request) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    schoolId?: string;
    month?: string;
    ingredientId?: string;
    quantity?: number;
    unitPrice?: number;
    purchasedOn?: string;
    notes?: string;
    vendorId?: string;
  };

  if (!body.schoolId || !body.month || !body.ingredientId) {
    return NextResponse.json(
      { error: "schoolId, month, and ingredientId are required" },
      { status: 400 },
    );
  }

  const outcome = await createKitchenPurchase({
    schoolId: body.schoolId,
    month: body.month,
    ingredientId: body.ingredientId,
    quantity: body.quantity ?? 0,
    unitPrice: body.unitPrice ?? 0,
    purchasedOn: body.purchasedOn ?? null,
    notes: body.notes?.trim() || null,
    vendorId: body.vendorId || null,
    createdBy: auth.userId,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome, { status: 201 });
}
