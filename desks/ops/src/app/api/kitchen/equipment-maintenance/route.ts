import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import {
  createKitchenEquipmentMaintenanceLog,
  listKitchenEquipmentMaintenanceLog,
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

/** GET /api/kitchen/equipment-maintenance?equipmentId= — admin/finance/kitchen roles */
export async function GET(request: Request) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const equipmentId = searchParams.get("equipmentId");
  if (!equipmentId) {
    return NextResponse.json({ error: "equipmentId is required" }, { status: 400 });
  }

  const entries = await listKitchenEquipmentMaintenanceLog(equipmentId);
  return NextResponse.json({ entries });
}

/**
 * POST /api/kitchen/equipment-maintenance — admin/finance/ops/finance-manager/cfo only
 * Body: { equipmentId, description, cost?, loggedOn? }
 */
export async function POST(request: Request) {
  const auth = await requireUser(["admin", "finance", "ops_manager", "finance_manager", "cfo"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    equipmentId?: string;
    description?: string;
    cost?: number;
    loggedOn?: string;
  };

  if (!body.equipmentId || !body.description?.trim()) {
    return NextResponse.json(
      { error: "equipmentId and description are required" },
      { status: 400 },
    );
  }

  const outcome = await createKitchenEquipmentMaintenanceLog({
    equipmentId: body.equipmentId,
    description: body.description.trim(),
    cost: body.cost ?? null,
    loggedOn: body.loggedOn,
    createdBy: auth.userId,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome, { status: 201 });
}
