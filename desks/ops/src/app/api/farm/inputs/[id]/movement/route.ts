import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { recordInputMovement } from "@/lib/db/farm";

const REASONS = ["restock", "used", "adjustment", "waste"] as const;
type MovementReason = (typeof REASONS)[number];

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/farm/inputs/:id/movement — admin/finance
 * Adjusts stock and logs the movement via recordInputMovement.
 */
export async function POST(request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const body = (await request.json()) as {
    delta?: number;
    reason?: MovementReason;
    expenseId?: string | null;
    activityId?: string | null;
  };

  if (typeof body.delta !== "number" || !Number.isFinite(body.delta)) {
    return NextResponse.json(
      { error: "delta must be a finite number" },
      { status: 400 },
    );
  }
  if (!body.reason || !REASONS.includes(body.reason)) {
    return NextResponse.json({ error: "invalid reason" }, { status: 400 });
  }

  const outcome = await recordInputMovement({
    inputId: id,
    delta: body.delta,
    reason: body.reason,
    expenseId: body.expenseId ?? null,
    activityId: body.activityId ?? null,
    createdBy: auth.userId,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
