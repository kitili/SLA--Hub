import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import { listKitchenChecklistTemplates, type KitchenChecklistCadence } from "@/lib/db/kitchen";

const KITCHEN_ROLES: Role[] = [
  "admin",
  "finance",
  "ops_manager",
  "finance_manager",
  "cfo",
  "cook",
  "head_of_kitchens",
];

const CADENCES: KitchenChecklistCadence[] = ["daily", "weekly", "monthly"];

/** GET /api/kitchen/checklist-templates?cadence= — admin/finance/kitchen roles */
export async function GET(request: Request) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const cadenceParam = searchParams.get("cadence");
  const cadence =
    cadenceParam && CADENCES.includes(cadenceParam as KitchenChecklistCadence)
      ? (cadenceParam as KitchenChecklistCadence)
      : undefined;

  const templates = await listKitchenChecklistTemplates(cadence);
  return NextResponse.json({ templates });
}
