import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import {
  createKitchenStaffMember,
  listKitchenStaffMembers,
  type KitchenStaffRole,
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

/** GET /api/kitchen/staff-members?schoolId= — admin/finance/kitchen roles */
export async function GET(request: Request) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const schoolId = searchParams.get("schoolId");
  if (!schoolId) {
    return NextResponse.json({ error: "schoolId is required" }, { status: 400 });
  }

  const members = await listKitchenStaffMembers(schoolId);
  return NextResponse.json({ members });
}

/**
 * POST /api/kitchen/staff-members — admin/ops/finance-manager/cfo only
 * Body: { schoolId, name, role }
 */
export async function POST(request: Request) {
  const auth = await requireUser(["admin", "ops_manager", "finance_manager", "cfo"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    schoolId?: string;
    name?: string;
    role?: KitchenStaffRole;
  };

  if (!body.schoolId || !body.name?.trim()) {
    return NextResponse.json(
      { error: "schoolId and name are required" },
      { status: 400 },
    );
  }

  const outcome = await createKitchenStaffMember({
    schoolId: body.schoolId,
    name: body.name.trim(),
    role: body.role ?? "cook",
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome, { status: 201 });
}
