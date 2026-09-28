import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import {
  createBudget,
  deleteBudget,
  listBudgets,
  updateBudget,
  type BudgetCategory,
} from "@/lib/db/finance";

const CATEGORIES: BudgetCategory[] = [
  "fuel",
  "maintenance",
  "salary",
  "insurance",
  "ops",
  "hire_cost",
  "other",
];

/** GET/POST /api/budgets */
export async function GET(request: Request) {
  const auth = await requireUser(["admin", "transport", "finance"]);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const budgets = await listBudgets({
    schoolId: searchParams.get("schoolId") ?? undefined,
    busId: searchParams.get("busId") ?? undefined,
    activeOn: searchParams.get("activeOn") ?? undefined,
  });
  return NextResponse.json({ budgets });
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "transport", "finance"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    schoolId?: string;
    busId?: string;
    name?: string;
    category?: BudgetCategory;
    periodStart?: string;
    periodEnd?: string;
    amount?: number;
    currency?: string;
    notes?: string;
  };

  if (
    !body.name?.trim() ||
    !body.periodStart ||
    !body.periodEnd ||
    typeof body.amount !== "number" ||
    body.amount < 0
  ) {
    return NextResponse.json(
      {
        error:
          "name, periodStart, periodEnd, and non-negative amount are required",
      },
      { status: 400 },
    );
  }
  if (body.category && !CATEGORIES.includes(body.category)) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }

  const outcome = await createBudget({
    schoolId: body.schoolId,
    busId: body.busId,
    name: body.name,
    category: body.category,
    periodStart: body.periodStart,
    periodEnd: body.periodEnd,
    amount: body.amount,
    currency: body.currency,
    notes: body.notes,
    createdBy: auth.userId,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ budget: outcome.budget }, { status: 201 });
}

/** PATCH /api/budgets?id= */
export async function PATCH(request: Request) {
  const auth = await requireUser(["admin", "transport", "finance"]);
  if ("response" in auth) return auth.response;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id query param required" }, { status: 400 });
  }

  const body = (await request.json()) as {
    name?: string;
    category?: BudgetCategory;
    periodStart?: string;
    periodEnd?: string;
    amount?: number;
    schoolId?: string | null;
    busId?: string | null;
    notes?: string | null;
  };
  if (body.category && !CATEGORIES.includes(body.category)) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }

  const outcome = await updateBudget(id, { ...body, updatedBy: auth.userId });
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ budget: outcome.budget });
}

/** DELETE /api/budgets?id= */
export async function DELETE(request: Request) {
  const auth = await requireUser(["admin", "transport", "finance"]);
  if ("response" in auth) return auth.response;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id query param required" }, { status: 400 });
  }

  const outcome = await deleteBudget(id);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
