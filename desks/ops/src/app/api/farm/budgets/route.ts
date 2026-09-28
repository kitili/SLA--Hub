import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import {
  listFarmBudgets,
  upsertFarmBudget,
  type FarmBudgetCategory,
} from "@/lib/db/farm";

const CATEGORIES: FarmBudgetCategory[] = [
  "seed",
  "fertilizer",
  "labor",
  "tools",
  "irrigation",
  "pest_control",
  "other",
  "all",
];

/**
 * GET  /api/farm/budgets?period= — admin/finance
 * POST /api/farm/budgets — admin/finance (upsert on category+period)
 */
export async function GET(request: Request) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const budgets = await listFarmBudgets(searchParams.get("period") ?? undefined);
  return NextResponse.json({ budgets });
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    category?: FarmBudgetCategory;
    period?: string;
    plannedAmount?: number;
    currency?: string;
    notes?: string | null;
  };

  if (!body.category || !CATEGORIES.includes(body.category)) {
    return NextResponse.json({ error: "valid category is required" }, { status: 400 });
  }
  if (!body.period?.trim()) {
    return NextResponse.json({ error: "period is required" }, { status: 400 });
  }
  if (
    typeof body.plannedAmount !== "number" ||
    !Number.isFinite(body.plannedAmount) ||
    body.plannedAmount < 0
  ) {
    return NextResponse.json(
      { error: "non-negative plannedAmount is required" },
      { status: 400 },
    );
  }

  const outcome = await upsertFarmBudget({
    category: body.category,
    period: body.period.trim(),
    plannedAmount: body.plannedAmount,
    currency: body.currency,
    notes: body.notes ?? null,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ budget: outcome.budget }, { status: 201 });
}
