import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import {
  createKitchenSurveyResponse,
  listKitchenSurveyResponses,
  type KitchenConsistencyRating,
  type KitchenQualityRating,
  type KitchenSatisfactionLevel,
  type KitchenSurveySource,
} from "@/lib/db/kitchen";

const KITCHEN_ROLES: Role[] = [
  "admin",
  "finance",
  "ops_manager",
  "finance_manager",
  "cfo",
  "cook",
  "head_of_kitchens",
  "matron",
];

// Narrower than the read list above -- matches the "Kitchen roles submit survey
// responses" RLS policy, which doesn't include finance (this is a
// service-quality survey submission, not a finance write path).
const SURVEY_SUBMIT_ROLES: Role[] = [
  "admin",
  "ops_manager",
  "finance_manager",
  "cfo",
  "cook",
  "head_of_kitchens",
  "matron",
];

/** GET /api/kitchen/survey-responses?schoolId= — admin/finance/kitchen/matron roles */
export async function GET(request: Request) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const schoolId = searchParams.get("schoolId") ?? undefined;

  const responses = await listKitchenSurveyResponses({ schoolId });
  return NextResponse.json({ responses });
}

/**
 * POST /api/kitchen/survey-responses — admin/kitchen/matron roles (not finance)
 * Body: { schoolId?, classOrGrade?, source, qualityRating?, servedOnTime?,
 *         sufficientQuantity?, consistencyRating?, satisfactionLevel?, commentText? }
 */
export async function POST(request: Request) {
  const auth = await requireUser(SURVEY_SUBMIT_ROLES);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    schoolId?: string;
    classOrGrade?: string;
    source?: KitchenSurveySource;
    qualityRating?: KitchenQualityRating;
    servedOnTime?: boolean;
    sufficientQuantity?: boolean;
    consistencyRating?: KitchenConsistencyRating;
    satisfactionLevel?: KitchenSatisfactionLevel;
    commentText?: string;
  };

  if (!body.source) {
    return NextResponse.json({ error: "source is required" }, { status: 400 });
  }

  const outcome = await createKitchenSurveyResponse({
    schoolId: body.schoolId ?? null,
    classOrGrade: body.classOrGrade?.trim() || null,
    source: body.source,
    qualityRating: body.qualityRating ?? null,
    servedOnTime: body.servedOnTime ?? null,
    sufficientQuantity: body.sufficientQuantity ?? null,
    consistencyRating: body.consistencyRating ?? null,
    satisfactionLevel: body.satisfactionLevel ?? null,
    commentText: body.commentText?.trim() || null,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome, { status: 201 });
}
