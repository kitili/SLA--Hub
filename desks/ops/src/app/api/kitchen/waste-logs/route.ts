import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import { createKitchenWasteLog, listKitchenWasteLogs, type KitchenWasteReason } from "@/lib/db/kitchen";

const KITCHEN_ROLES: Role[] = [
  "admin",
  "finance",
  "ops_manager",
  "finance_manager",
  "cfo",
  "cook",
  "head_of_kitchens",
];

/** GET /api/kitchen/waste-logs?schoolId=&start=&end= — admin/finance/kitchen roles */
export async function GET(request: Request) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const schoolId = searchParams.get("schoolId");
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!schoolId || !start || !end) {
    return NextResponse.json({ error: "schoolId, start, and end are required" }, { status: 400 });
  }

  const logs = await listKitchenWasteLogs(schoolId, start, end);
  return NextResponse.json({ logs });
}

/**
 * POST /api/kitchen/waste-logs — any kitchen role can log waste (cooks included)
 * Body: { schoolId, itemName, ingredientId?, quantity, unit, reason, notes?, loggedOn? }
 */
export async function POST(request: Request) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    schoolId?: string;
    itemName?: string;
    ingredientId?: string;
    quantity?: number;
    unit?: string;
    reason?: KitchenWasteReason;
    notes?: string;
    loggedOn?: string;
  };

  if (!body.schoolId || !body.itemName?.trim()) {
    return NextResponse.json({ error: "schoolId and itemName are required" }, { status: 400 });
  }
  if (body.quantity !== undefined && (!Number.isFinite(body.quantity) || body.quantity < 0 || body.quantity > 100_000)) {
    return NextResponse.json({ error: "quantity must be between 0 and 100,000" }, { status: 400 });
  }

  const outcome = await createKitchenWasteLog({
    schoolId: body.schoolId,
    itemName: body.itemName.trim(),
    ingredientId: body.ingredientId || null,
    quantity: body.quantity ?? 0,
    unit: body.unit ?? "kg",
    reason: body.reason ?? "other",
    notes: body.notes?.trim() || null,
    loggedOn: body.loggedOn,
    createdBy: auth.userId,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome, { status: 201 });
}
