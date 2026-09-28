import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import {
  createExpense,
  deleteExpense,
  listExpenses,
  updateExpense,
  type ExpenseCategory,
} from "@/lib/db/finance";

const CATEGORIES: ExpenseCategory[] = [
  "fuel",
  "maintenance",
  "salary",
  "insurance",
  "toll",
  "parts",
  "hire_cost",
  "other",
];

/** GET/POST /api/expenses */
export async function GET(request: Request) {
  const auth = await requireUser(["admin", "transport", "finance", "matron"]);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const expenses = await listExpenses({
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    schoolId: searchParams.get("schoolId") ?? undefined,
  });
  return NextResponse.json({ expenses });
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "transport", "finance"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    schoolId?: string;
    busId?: string;
    category?: ExpenseCategory;
    title?: string;
    amount?: number;
    currency?: string;
    spentOn?: string;
    notes?: string;
  };

  if (
    !body.schoolId?.trim() ||
    !body.title?.trim() ||
    typeof body.amount !== "number" ||
    body.amount < 0
  ) {
    return NextResponse.json(
      { error: "schoolId, title, and non-negative amount are required" },
      { status: 400 },
    );
  }
  if (body.category && !CATEGORIES.includes(body.category)) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }

  const outcome = await createExpense({
    schoolId: body.schoolId,
    busId: body.busId,
    category: body.category,
    title: body.title,
    amount: body.amount,
    currency: body.currency,
    spentOn: body.spentOn,
    notes: body.notes,
    createdBy: auth.userId,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ expense: outcome.expense }, { status: 201 });
}

/** PATCH /api/expenses?id= */
export async function PATCH(request: Request) {
  const auth = await requireUser(["admin", "transport", "finance"]);
  if ("response" in auth) return auth.response;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id query param required" }, { status: 400 });
  }

  const body = (await request.json()) as {
    category?: ExpenseCategory;
    title?: string;
    amount?: number;
    spentOn?: string;
    notes?: string | null;
  };
  if (body.category && !CATEGORIES.includes(body.category)) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }

  const outcome = await updateExpense(id, { ...body, updatedBy: auth.userId });
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ expense: outcome.expense });
}

/** DELETE /api/expenses?id= */
export async function DELETE(request: Request) {
  const auth = await requireUser(["admin", "transport", "finance"]);
  if ("response" in auth) return auth.response;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id query param required" }, { status: 400 });
  }

  const outcome = await deleteExpense(id);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
