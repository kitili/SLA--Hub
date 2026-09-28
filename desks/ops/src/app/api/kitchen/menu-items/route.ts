import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import { createKitchenMenuItem, listKitchenMenuItems } from "@/lib/db/kitchen";

const KITCHEN_ROLES: Role[] = [
  "admin",
  "finance",
  "ops_manager",
  "finance_manager",
  "cfo",
  "cook",
  "head_of_kitchens",
];

/** GET /api/kitchen/menu-items — admin/finance/kitchen roles */
export async function GET() {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const items = await listKitchenMenuItems();
  return NextResponse.json({ items });
}

/**
 * POST /api/kitchen/menu-items — admin/ops/finance-manager/cfo/head-of-kitchens
 * Body: { name, notes? }
 */
export async function POST(request: Request) {
  const auth = await requireUser(["admin", "ops_manager", "finance_manager", "cfo", "head_of_kitchens"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as { name?: string; notes?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const outcome = await createKitchenMenuItem({
    name: body.name.trim(),
    notes: body.notes?.trim() || null,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome, { status: 201 });
}
