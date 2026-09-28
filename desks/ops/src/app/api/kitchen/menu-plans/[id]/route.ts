import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { deleteKitchenMenuPlan, updateKitchenMenuPlan } from "@/lib/db/kitchen";

type Ctx = { params: Promise<{ id: string }> };

/** DELETE /api/kitchen/menu-plans/:id — admin/ops/finance-manager/cfo/head-of-kitchens */
export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "ops_manager", "finance_manager", "cfo", "head_of_kitchens"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const outcome = await deleteKitchenMenuPlan(id);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/kitchen/menu-plans/:id — admin/ops/finance-manager/cfo/head-of-kitchens
 * Body: { menuItemId?, notes? } -- used to swap the dish assigned to a cell in place.
 */
export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "ops_manager", "finance_manager", "cfo", "head_of_kitchens"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const body = (await request.json()) as { menuItemId?: string; notes?: string | null };

  const outcome = await updateKitchenMenuPlan(id, body);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome);
}
