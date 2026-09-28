import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { FACILITIES_ROLES } from "@/lib/facilities-access";
import { createIssue, listIssues, logIssueAsExpense, type IssueStatus } from "@/lib/db/facilities";

const STATUSES: IssueStatus[] = ["open", "in_progress", "completed", "cancelled"];

/** GET/POST /api/facilities/issues */
export async function GET(request: Request) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as IssueStatus | null;
  if (status && !STATUSES.includes(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const issues = await listIssues({
    status: status ?? undefined,
    schoolId: searchParams.get("schoolId") ?? undefined,
  });
  return NextResponse.json({ issues });
}

export async function POST(request: Request) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    schoolId?: string;
    description?: string;
    status?: IssueStatus;
    reportedBy?: string;
    accountable?: string;
    responsible?: string;
    reportDate?: string;
    deadline?: string;
    resolvedDate?: string;
    nextSteps?: string;
    notes?: string;
    cost?: number;
    logAsExpense?: boolean;
  };

  if (!body.description?.trim()) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }
  if (body.status && !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const outcome = await createIssue({
    schoolId: body.schoolId,
    description: body.description,
    status: body.status,
    reportedBy: body.reportedBy,
    accountable: body.accountable,
    responsible: body.responsible,
    reportDate: body.reportDate,
    deadline: body.deadline,
    resolvedDate: body.resolvedDate,
    nextSteps: body.nextSteps,
    notes: body.notes,
    cost: body.cost,
    createdBy: auth.userId,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  if (body.logAsExpense) {
    const linked = await logIssueAsExpense(outcome.issue, auth.userId);
    if ("error" in linked) {
      return NextResponse.json(
        { issue: outcome.issue, expenseError: linked.error },
        { status: 201 },
      );
    }
    return NextResponse.json({ issue: linked.issue }, { status: 201 });
  }

  return NextResponse.json({ issue: outcome.issue }, { status: 201 });
}
