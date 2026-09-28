import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import { createKitchenVendor, listKitchenVendors } from "@/lib/db/kitchen";

const KITCHEN_ROLES: Role[] = [
  "admin",
  "finance",
  "ops_manager",
  "finance_manager",
  "cfo",
  "cook",
  "head_of_kitchens",
];

/** GET /api/kitchen/vendors — admin/finance/kitchen roles */
export async function GET() {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const vendors = await listKitchenVendors();
  return NextResponse.json({ vendors });
}

/**
 * POST /api/kitchen/vendors — admin/finance/ops/finance-manager/cfo only
 * Body: { name, contactPerson?, contactPhone?, notes? }
 */
export async function POST(request: Request) {
  const auth = await requireUser(["admin", "finance", "ops_manager", "finance_manager", "cfo"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    name?: string;
    contactPerson?: string;
    contactPhone?: string;
    notes?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const outcome = await createKitchenVendor({
    name: body.name.trim(),
    contactPerson: body.contactPerson?.trim() || null,
    contactPhone: body.contactPhone?.trim() || null,
    notes: body.notes?.trim() || null,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome, { status: 201 });
}
