import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import type { Role } from "@/lib/roles";
import {
  listKitchenChecklistEntries,
  listKitchenChecklistEntriesForSchools,
  upsertKitchenChecklistEntry,
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

// Narrower than the read list above -- matches the "Kitchen roles submit/update
// checklist entries" RLS policies, which don't include finance (this is a
// kitchen-staff compliance form, not a finance write path).
const CHECKLIST_WRITE_ROLES: Role[] = [
  "admin",
  "ops_manager",
  "finance_manager",
  "cfo",
  "cook",
  "head_of_kitchens",
];

/**
 * GET /api/kitchen/checklist-entries?schoolId=&periodDates=csv
 * schoolId may be a single uuid or a comma-separated list (compliance rollup).
 */
export async function GET(request: Request) {
  const auth = await requireUser(KITCHEN_ROLES);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const schoolId = searchParams.get("schoolId");
  const periodDatesParam = searchParams.get("periodDates");
  if (!schoolId || !periodDatesParam) {
    return NextResponse.json(
      { error: "schoolId and periodDates are required" },
      { status: 400 },
    );
  }

  const periodDates = periodDatesParam.split(",").map((s) => s.trim()).filter(Boolean);
  const schoolIds = schoolId.split(",").map((s) => s.trim()).filter(Boolean);
  const entries =
    schoolIds.length > 1
      ? await listKitchenChecklistEntriesForSchools(schoolIds, periodDates)
      : await listKitchenChecklistEntries(schoolIds[0]!, periodDates);
  return NextResponse.json({ entries });
}

/**
 * POST /api/kitchen/checklist-entries — admin/ops/cook/kitchen-staff roles (not finance)
 * Body: { templateId, schoolId, periodDate, scoreValue, comment? }
 * Upserts one entry (one row per template/school/period).
 */
export async function POST(request: Request) {
  const auth = await requireUser(CHECKLIST_WRITE_ROLES);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    templateId?: string;
    schoolId?: string;
    periodDate?: string;
    scoreValue?: number;
    comment?: string;
  };

  if (!body.templateId || !body.schoolId || !body.periodDate || body.scoreValue === undefined) {
    return NextResponse.json(
      { error: "templateId, schoolId, periodDate, and scoreValue are required" },
      { status: 400 },
    );
  }

  const outcome = await upsertKitchenChecklistEntry({
    templateId: body.templateId,
    schoolId: body.schoolId,
    periodDate: body.periodDate,
    scoreValue: body.scoreValue,
    comment: body.comment?.trim() || null,
    submittedBy: auth.userId,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome);
}
