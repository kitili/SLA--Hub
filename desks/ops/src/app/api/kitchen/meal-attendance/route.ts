import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import {
  listKitchenMealAttendance,
  upsertKitchenMealAttendance,
  type KitchenMealSlot,
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

/** GET /api/kitchen/meal-attendance?schoolId=&start=&end= — admin/finance/kitchen roles */
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

  const attendance = await listKitchenMealAttendance(schoolId, start, end);
  return NextResponse.json({ attendance });
}

/**
 * POST /api/kitchen/meal-attendance — any kitchen role (cooks record this at serving time)
 * Body: { schoolId, serveDate, mealSlot, actualHeadcount, notes? }
 * Upserts one row per school/date/meal_slot.
 */
export async function POST(request: Request) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    schoolId?: string;
    serveDate?: string;
    mealSlot?: KitchenMealSlot;
    actualHeadcount?: number;
    notes?: string;
  };

  if (!body.schoolId || !body.serveDate || !body.mealSlot || body.actualHeadcount === undefined) {
    return NextResponse.json(
      { error: "schoolId, serveDate, mealSlot, and actualHeadcount are required" },
      { status: 400 },
    );
  }

  const outcome = await upsertKitchenMealAttendance({
    schoolId: body.schoolId,
    serveDate: body.serveDate,
    mealSlot: body.mealSlot,
    actualHeadcount: body.actualHeadcount,
    notes: body.notes?.trim() || null,
    createdBy: auth.userId,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome, { status: 201 });
}
