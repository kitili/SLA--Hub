import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import {
  createKitchenEquipment,
  listKitchenEquipment,
  type KitchenEquipmentCategory,
  type KitchenEquipmentCondition,
} from "@/lib/db/kitchen";

const KITCHEN_ROLES: Role[] = [
  "admin",
  "finance",
  "ops_manager",
  "finance_manager",
  "cfo",
  "cook",
  "head_of_kitchens",
];

/** GET /api/kitchen/equipment?schoolId= — admin/finance/kitchen roles */
export async function GET(request: Request) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const schoolId = searchParams.get("schoolId");
  if (!schoolId) {
    return NextResponse.json({ error: "schoolId is required" }, { status: 400 });
  }

  const equipment = await listKitchenEquipment(schoolId);
  return NextResponse.json({ equipment });
}

/**
 * POST /api/kitchen/equipment — admin/finance/ops/finance-manager/cfo only
 * Body: { schoolId, name, category, quantity, condition, purchasedOn?, replacementCost?, notes? }
 */
export async function POST(request: Request) {
  const auth = await requireUser(["admin", "finance", "ops_manager", "finance_manager", "cfo"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    schoolId?: string;
    name?: string;
    category?: KitchenEquipmentCategory;
    quantity?: number;
    condition?: KitchenEquipmentCondition;
    purchasedOn?: string;
    replacementCost?: number;
    notes?: string;
  };

  if (!body.schoolId || !body.name?.trim()) {
    return NextResponse.json({ error: "schoolId and name are required" }, { status: 400 });
  }
  if (body.quantity !== undefined && (!Number.isFinite(body.quantity) || body.quantity < 0 || body.quantity > 100_000)) {
    return NextResponse.json({ error: "quantity must be between 0 and 100,000" }, { status: 400 });
  }
  if (
    body.replacementCost !== undefined &&
    (!Number.isFinite(body.replacementCost) || body.replacementCost < 0 || body.replacementCost > 1_000_000_000)
  ) {
    return NextResponse.json({ error: "replacementCost must be between 0 and 1,000,000,000" }, { status: 400 });
  }

  const outcome = await createKitchenEquipment({
    schoolId: body.schoolId,
    name: body.name.trim(),
    category: body.category ?? "other",
    quantity: body.quantity ?? 1,
    condition: body.condition ?? "good",
    purchasedOn: body.purchasedOn ?? null,
    replacementCost: body.replacementCost ?? null,
    notes: body.notes?.trim() || null,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome, { status: 201 });
}
