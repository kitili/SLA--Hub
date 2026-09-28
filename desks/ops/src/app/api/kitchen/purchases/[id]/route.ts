import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import { deleteKitchenPurchase, updateKitchenPurchase } from "@/lib/db/kitchen";

type Ctx = { params: Promise<{ id: string }> };

const KITCHEN_ROLES: Role[] = ["admin", "finance", "ops_manager", "finance_manager", "cfo"];

/** DELETE /api/kitchen/purchases/:id — admin/finance/kitchen roles */
export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const outcome = await deleteKitchenPurchase(id);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/kitchen/purchases/:id — admin/finance/kitchen roles
 * Body: { quantity?, unitPrice?, purchasedOn?, notes? }
 */
export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const body = (await request.json()) as {
    quantity?: number;
    unitPrice?: number;
    purchasedOn?: string | null;
    notes?: string | null;
  };

  const outcome = await updateKitchenPurchase(id, body);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome);
}
