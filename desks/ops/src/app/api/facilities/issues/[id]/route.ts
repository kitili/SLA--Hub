import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { FACILITIES_ROLES } from "@/lib/facilities-access";
import { deleteIssue, logIssueAsExpense, updateIssue, type IssueStatus } from "@/lib/db/facilities";

const STATUSES: IssueStatus[] = ["open", "in_progress", "completed", "cancelled"];

/** PATCH /api/facilities/issues/:id */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const body = (await request.json()) as {
    schoolId?: string | null;
    description?: string;
    status?: IssueStatus;
    reportedBy?: string | null;
    accountable?: string | null;
    responsible?: string | null;
    reportDate?: string;
    deadline?: string | null;
    resolvedDate?: string | null;
    nextSteps?: string | null;
    notes?: string | null;
    cost?: number | null;
    logAsExpense?: boolean;
  };
  if (body.status && !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const { logAsExpense, ...patch } = body;
  const outcome = await updateIssue(id, {
    ...patch,
    updatedBy: auth.userId,
  });
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  if (logAsExpense) {
    const linked = await logIssueAsExpense(outcome.issue, auth.userId);
    if ("error" in linked) {
      return NextResponse.json(
        { issue: outcome.issue, expenseError: linked.error },
        { status: 200 },
      );
    }
    return NextResponse.json({ issue: linked.issue });
  }

  return NextResponse.json({ issue: outcome.issue });
}

/** DELETE /api/facilities/issues/:id */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(FACILITIES_ROLES);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const outcome = await deleteIssue(id);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
