import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import { deleteKitchenWasteLog, updateKitchenWasteLog } from "@/lib/db/kitchen";
import type { KitchenWasteReason } from "@/lib/db/kitchen";

type Ctx = { params: Promise<{ id: string }> };

const KITCHEN_ROLES: Role[] = [
  "admin",
  "finance",
  "ops_manager",
  "finance_manager",
  "cfo",
  "cook",
  "head_of_kitchens",
];

/** DELETE /api/kitchen/waste-logs/:id — admin/finance/kitchen roles */
export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const outcome = await deleteKitchenWasteLog(id);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/kitchen/waste-logs/:id — admin/finance/kitchen roles
 * Body: { itemName?, quantity?, unit?, reason?, notes? }
 */
export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const body = (await request.json()) as {
    itemName?: string;
    quantity?: number;
    unit?: string;
    reason?: KitchenWasteReason;
    notes?: string | null;
  };

  const outcome = await updateKitchenWasteLog(id, body);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome);
}
