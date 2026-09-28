import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { updateKitchenVendor } from "@/lib/db/kitchen";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/kitchen/vendors/:id — admin/finance/ops/finance-manager/cfo only
 * Body: { name?, contactPerson?, contactPhone?, notes?, active? }
 */
export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "finance", "ops_manager", "finance_manager", "cfo"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const body = (await request.json()) as {
    name?: string;
    contactPerson?: string | null;
    contactPhone?: string | null;
    notes?: string | null;
    active?: boolean;
  };

  const outcome = await updateKitchenVendor(id, body);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome);
}
