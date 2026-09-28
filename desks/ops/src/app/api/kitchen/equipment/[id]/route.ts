import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { updateKitchenEquipment, type KitchenEquipmentCondition } from "@/lib/db/kitchen";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/kitchen/equipment/:id — admin/finance/ops/finance-manager/cfo only
 * Body: { quantity?, condition?, notes?, active? }
 */
export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "finance", "ops_manager", "finance_manager", "cfo"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const body = (await request.json()) as {
    quantity?: number;
    condition?: KitchenEquipmentCondition;
    notes?: string | null;
    active?: boolean;
  };

  if (body.quantity !== undefined && (!Number.isFinite(body.quantity) || body.quantity < 0 || body.quantity > 100_000)) {
    return NextResponse.json({ error: "quantity must be between 0 and 100,000" }, { status: 400 });
  }

  const outcome = await updateKitchenEquipment(id, body);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome);
}
