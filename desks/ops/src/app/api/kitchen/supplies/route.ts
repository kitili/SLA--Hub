import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import { createKitchenSupply, listKitchenSupplies } from "@/lib/db/kitchen";

const KITCHEN_ROLES: Role[] = [
  "admin",
  "finance",
  "ops_manager",
  "finance_manager",
  "cfo",
  "cook",
  "head_of_kitchens",
];

/** GET /api/kitchen/supplies — admin/finance/kitchen roles */
export async function GET() {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const supplies = await listKitchenSupplies();
  return NextResponse.json({ supplies });
}

/**
 * POST /api/kitchen/supplies — admin/finance/ops/finance-manager/cfo only
 * Body: { name, unit, defaultUnitPrice }
 */
export async function POST(request: Request) {
  const auth = await requireUser(["admin", "finance", "ops_manager", "finance_manager", "cfo"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as { name?: string; unit?: string; defaultUnitPrice?: number };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const outcome = await createKitchenSupply({
    name: body.name.trim(),
    unit: body.unit?.trim() || "unit",
    defaultUnitPrice: body.defaultUnitPrice ?? 0,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome, { status: 201 });
}
