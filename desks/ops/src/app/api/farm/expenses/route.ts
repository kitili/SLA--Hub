import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import {
  createFarmExpense,
  listFarmExpenses,
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

/**
 * GET  /api/farm/expenses?plotId=&category=&from=&to= — admin/finance
 * POST /api/farm/expenses — admin/finance
 */
export async function GET(request: Request) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") as FarmExpenseCategory | null;
  if (category && !CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }

  const expenses = await listFarmExpenses({
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    plotId: searchParams.get("plotId") ?? undefined,
    category: category ?? undefined,
  });
  return NextResponse.json({ expenses });
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "finance", "farm", "ops_manager"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    category?: FarmExpenseCategory;
    amount?: number;
    currency?: string;
    spentOn?: string;
    plotId?: string | null;
    plantingId?: string | null;
    inputId?: string | null;
    notes?: string | null;
  };

  if (!body.category || !CATEGORIES.includes(body.category)) {
    return NextResponse.json({ error: "valid category is required" }, { status: 400 });
  }
  if (typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount < 0) {
    return NextResponse.json(
      { error: "non-negative amount is required" },
      { status: 400 },
    );
  }

  const outcome = await createFarmExpense({
    category: body.category,
    amount: body.amount,
    currency: body.currency,
    spentOn: body.spentOn,
    plotId: body.plotId ?? null,
    plantingId: body.plantingId ?? null,
    inputId: body.inputId ?? null,
    notes: body.notes ?? null,
    createdBy: auth.userId,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json({ expense: outcome.expense }, { status: 201 });
}
