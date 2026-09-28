import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import { deleteKitchenDaycareRecord } from "@/lib/db/kitchen";

type Ctx = { params: Promise<{ id: string }> };

const KITCHEN_WRITE_ROLES: Role[] = [
  "admin",
  "ops_manager",
  "finance_manager",
  "cfo",
  "head_of_kitchens",
];

/** DELETE /api/kitchen/daycare/:id — admin/ops-tier roles only */
export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireUser(KITCHEN_WRITE_ROLES);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const outcome = await deleteKitchenDaycareRecord(id);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
