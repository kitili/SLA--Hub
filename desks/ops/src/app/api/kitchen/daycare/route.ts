import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import { listKitchenDaycareRecords, upsertKitchenDaycareRecord } from "@/lib/db/kitchen";

const KITCHEN_READ_ROLES: Role[] = [
  "admin",
  "finance",
  "ops_manager",
  "finance_manager",
  "cfo",
  "cook",
  "head_of_kitchens",
];

const KITCHEN_WRITE_ROLES: Role[] = [
  "admin",
  "ops_manager",
  "finance_manager",
  "cfo",
  "head_of_kitchens",
];

/** GET /api/kitchen/daycare — every month on record, newest first */
export async function GET() {
  const auth = await requireUser(KITCHEN_READ_ROLES);
  if ("response" in auth) return auth.response;

  const records = await listKitchenDaycareRecords();
  return NextResponse.json({ records });
}

/**
 * POST /api/kitchen/daycare — admin/ops-tier roles only
 * Body: { month, kidCount?, monthlyCost?, currency?, menuNotes? }
 * Upserts one row per month.
 */
export async function POST(request: Request) {
  const auth = await requireUser(KITCHEN_WRITE_ROLES);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    month?: string;
    kidCount?: number | null;
    monthlyCost?: number | null;
    currency?: string;
    menuNotes?: string | null;
  };

  if (!body.month) {
    return NextResponse.json({ error: "month is required" }, { status: 400 });
  }

  const outcome = await upsertKitchenDaycareRecord({
    month: body.month,
    kidCount: body.kidCount ?? null,
    monthlyCost: body.monthlyCost ?? null,
    currency: body.currency,
    menuNotes: body.menuNotes?.trim() || null,
    createdBy: auth.userId,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome, { status: 201 });
}
