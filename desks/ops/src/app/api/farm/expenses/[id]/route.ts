import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import {
  deleteFarmExpense,
  updateFarmExpense,
  type FarmExpenseCategory,
} from "@/lib/db/farm";

const CATEGORIES: FarmExpenseCategory[] = [
  "seed",
  "fertilizer",
  "labor",
  "tools",
  "irrigation",
  "pest_control",
  "other",
];

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const body = (await request.json()) as {
    category?: FarmExpenseCategory;
    amount?: number;
    currency?: string;
    spentOn?: string;
    plotId?: string | null;
    notes?: string | null;
  };

  if (body.category && !CATEGORIES.includes(body.category)) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }
  if (
    body.amount != null &&
    (!Number.isFinite(body.amount) || body.amount < 0)
  ) {
    return NextResponse.json({ error: "invalid amount" }, { status: 400 });
  }

  const outcome = await updateFarmExpense(id, body);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ expense: outcome.expense });
}

export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const outcome = await deleteFarmExpense(id);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
