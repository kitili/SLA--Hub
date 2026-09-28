import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import {
  createMaintenance,
  listMaintenance,
  type MaintenanceCategory,
  type MaintenanceStatus,
} from "@/lib/db/maintenance";

const CATEGORIES: MaintenanceCategory[] = [
  "service",
  "repair",
  "tyre",
  "fuel_system",
  "body",
  "inspection",
  "other",
];

/**
 * GET  /api/maintenance?busId=
 * POST /api/maintenance — admin/finance
 */
export async function GET(request: Request) {
  const auth = await requireUser(["admin", "transport", "finance", "matron", "driver"]);
  if ("response" in auth) return auth.response;

  const busId = new URL(request.url).searchParams.get("busId") ?? undefined;
  const records = await listMaintenance(busId ?? undefined);
  return NextResponse.json({ records });
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "transport", "finance"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as {
    busId?: string;
    title?: string;
    category?: MaintenanceCategory;
    status?: MaintenanceStatus;
    cost?: number;
    budgetAmount?: number | null;
    currency?: string;
    notes?: string;
    serviceDate?: string;
    dueDate?: string;
    expenseId?: string;
    createExpense?: boolean;
    vendorName?: string | null;
    vatAmount?: number | null;
    labourCost?: number | null;
  };

  if (!body.title?.trim()) {
    return NextResponse.json(
      { error: "title is required" },
      { status: 400 },
    );
  }

  if (body.category && !CATEGORIES.includes(body.category)) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }

  const busId = body.busId?.trim() || null;

  let expenseId = body.expenseId ?? null;
  let createdExpenseId: string | null = null;
  if (!expenseId && body.createExpense && (body.cost ?? 0) > 0) {
    const { createExpense } = await import("@/lib/db/finance");
    const exp = await createExpense({
      busId,
      category: "maintenance",
      title: body.title.trim(),
      amount: body.cost ?? 0,
      currency: body.currency,
      spentOn: body.serviceDate,
      notes: body.notes,
      createdBy: auth.userId,
    });
    if ("expense" in exp) {
      expenseId = exp.expense.id;
      createdExpenseId = exp.expense.id;
    }
  }

  const outcome = await createMaintenance({
    busId,
    title: body.title.trim(),
    category: body.category,
    status: body.status,
    cost: body.cost,
    budgetAmount: body.budgetAmount,
    currency: body.currency,
    notes: body.notes,
    serviceDate: body.serviceDate,
    dueDate: body.dueDate,
    expenseId,
    createdBy: auth.userId,
    vendorName: body.vendorName?.trim() || null,
    vatAmount: body.vatAmount ?? null,
    labourCost: body.labourCost ?? null,
  });

  if ("error" in outcome) {
    // The expense insert above already committed (no shared transaction) --
    // roll it back so a failed maintenance record never leaves an orphaned
    // Finance Ledger entry behind.
    if (createdExpenseId) {
      const { deleteExpense } = await import("@/lib/db/finance");
      await deleteExpense(createdExpenseId);
    }
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  return NextResponse.json({ record: outcome.record }, { status: 201 });
}
