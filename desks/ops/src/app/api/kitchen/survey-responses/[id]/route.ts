import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import {
  deleteKitchenSurveyResponse,
  updateKitchenSurveyResponse,
  type KitchenConsistencyRating,
  type KitchenQualityRating,
  type KitchenSatisfactionLevel,
  type KitchenSurveySource,
} from "@/lib/db/kitchen";

type Ctx = { params: Promise<{ id: string }> };

// Narrower than the broad KITCHEN_ROLES read/write list on the collection route --
// correcting submitted quality-survey data is restricted to admin/ops_manager only.
const KITCHEN_ROLES: Role[] = ["admin", "ops_manager"];

/** DELETE /api/kitchen/survey-responses/:id — admin/ops_manager only */
export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const outcome = await deleteKitchenSurveyResponse(id);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/kitchen/survey-responses/:id — admin/ops_manager only
 * Body: { schoolId?, classOrGrade?, source?, qualityRating?, servedOnTime?,
 *         sufficientQuantity?, consistencyRating?, satisfactionLevel?, commentText? }
 */
export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const body = (await request.json()) as {
    schoolId?: string | null;
    classOrGrade?: string | null;
    source?: KitchenSurveySource;
    qualityRating?: KitchenQualityRating | null;
    servedOnTime?: boolean | null;
    sufficientQuantity?: boolean | null;
    consistencyRating?: KitchenConsistencyRating | null;
    satisfactionLevel?: KitchenSatisfactionLevel | null;
    commentText?: string | null;
  };

  const outcome = await updateKitchenSurveyResponse(id, body);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome);
}
