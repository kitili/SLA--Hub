import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { updateKitchenStaffMember, type KitchenStaffRole } from "@/lib/db/kitchen";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/kitchen/staff-members/:id — admin/ops/finance-manager/cfo only
 * Body: { name?, role?, active? }
 */
export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "ops_manager", "finance_manager", "cfo"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const body = (await request.json()) as {
    name?: string;
    role?: KitchenStaffRole;
    active?: boolean;
  };

  const outcome = await updateKitchenStaffMember(id, body);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome);
}
