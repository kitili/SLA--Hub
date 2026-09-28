import { createClient } from "@/lib/supabase/server";
import { auditUpdatePatch } from "@/lib/audit/attribution";
import { budgetMatchesExpense } from "@/lib/finance/budget-match";

export type ExpenseCategory =
  | "fuel"
  | "maintenance"
  | "salary"
  | "insurance"
  | "toll"
  | "parts"
  | "hire_cost"
  | "other";

export type RevenueCategory =
  | "transport_fees"
  | "hire_out"
  | "grant"
  | "other";

export type HirePurpose = "wedding" | "burial" | "event" | "other";
export type HireStatus =
  | "inquiry"
  | "booked"
  | "in_progress"
  | "completed"
  | "cancelled";

export type BudgetCategory =
  | "fuel"
  | "maintenance"
  | "salary"
  | "insurance"
  | "ops"
  | "hire_cost"
  | "other";

export type Expense = {
  id: string;
  school_id: string | null;
  bus_id: string | null;
  category: ExpenseCategory;
  title: string;
  amount: number;
  currency: string;
  spent_on: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
};

export type Revenue = {
  id: string;
  school_id: string | null;
  bus_id: string | null;
  category: RevenueCategory;
  title: string;
  amount: number;
  currency: string;
  earned_on: string;
  notes: string | null;
  hire_out_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
};

export type HireOut = {
  id: string;
  bus_id: string;
  school_id: string | null;
  client_name: string;
  purpose: HirePurpose;
  start_at: string;
  end_at: string;
  quoted_amount: number;
  currency: string;
  status: HireStatus;
  notes: string | null;
  revenue_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_by?: string | null;
  updated_at?: string | null;
  bus_label?: string;
};

export type Budget = {
  id: string;
  school_id: string | null;
  bus_id: string | null;
  name: string;
  category: BudgetCategory;
  period_start: string;
  period_end: string;
  amount: number;
  currency: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
};

export type PnLReport = {
  from: string;
  to: string;
  currency: string;
  total_revenue: number;
  total_expense: number;
  net: number;
  revenue_by_category: Record<string, number>;
  expense_by_category: Record<string, number>;
  budgets: {
    id: string;
    name: string;
    category: string;
    budget_amount: number;
    spent: number;
    remaining: number;
    burn_pct: number;
  }[];
  hire_outs_in_period: number;
  hire_out_quoted: number;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const EXPENSE_SELECT =
  "id, school_id, bus_id, category, title, amount, currency, spent_on, notes, created_by, created_at, updated_by, updated_at";
const REVENUE_SELECT =
  "id, school_id, bus_id, category, title, amount, currency, earned_on, notes, hire_out_id, created_by, created_at, updated_by, updated_at";
// bus_id is pending schema_week3.sql's "add column if not exists bus_id"
// migration (confirmed not yet applied live, 2026-08-19: a direct query for
// budgets.bus_id returns "column budgets.bus_id does not exist"). Every read
// and write below tries the full column list first and falls back to the
// no-bus_id list on that specific error, so per-bus budgets self-activate
// the moment the migration runs -- no follow-up code change needed.
const BUDGET_COLUMNS =
  "id, school_id, bus_id, name, category, period_start, period_end, amount, currency, notes, created_by, created_at, updated_by, updated_at";
const BUDGET_SELECT = BUDGET_COLUMNS;
const BUDGET_COLUMNS_NO_BUS_ID =
  "id, school_id, name, category, period_start, period_end, amount, currency, notes, created_by, created_at, updated_by, updated_at";

function isMissingBusIdError(error: { message: string } | null | undefined): boolean {
  return !!error && /bus_id/i.test(error.message);
}

function mapExpense(r: Record<string, unknown>): Expense {
  return {
    id: r.id as string,
    school_id: (r.school_id as string | null) ?? null,
    bus_id: (r.bus_id as string | null) ?? null,
    category: r.category as ExpenseCategory,
    title: r.title as string,
    amount: num(r.amount),
    currency: (r.currency as string) ?? "TZS",
    spent_on: r.spent_on as string,
    notes: (r.notes as string | null) ?? null,
    created_by: (r.created_by as string | null) ?? null,
    created_at: r.created_at as string,
    updated_by: (r.updated_by as string | null) ?? null,
    updated_at: (r.updated_at as string | null) ?? null,
  };
}

function mapRevenue(r: Record<string, unknown>): Revenue {
  return {
    id: r.id as string,
    school_id: (r.school_id as string | null) ?? null,
    bus_id: (r.bus_id as string | null) ?? null,
    category: r.category as RevenueCategory,
    title: r.title as string,
    amount: num(r.amount),
    currency: (r.currency as string) ?? "TZS",
    earned_on: r.earned_on as string,
    notes: (r.notes as string | null) ?? null,
    hire_out_id: (r.hire_out_id as string | null) ?? null,
    created_by: (r.created_by as string | null) ?? null,
    created_at: r.created_at as string,
    updated_by: (r.updated_by as string | null) ?? null,
    updated_at: (r.updated_at as string | null) ?? null,
  };
}

function mapBudget(r: Record<string, unknown>): Budget {
  return {
    id: r.id as string,
    school_id: (r.school_id as string | null) ?? null,
    bus_id: (r.bus_id as string | null) ?? null,
    name: r.name as string,
    category: r.category as BudgetCategory,
    period_start: r.period_start as string,
    period_end: r.period_end as string,
    amount: num(r.amount),
    currency: (r.currency as string) ?? "TZS",
    notes: (r.notes as string | null) ?? null,
    created_by: (r.created_by as string | null) ?? null,
    created_at: r.created_at as string,
    updated_by: (r.updated_by as string | null) ?? null,
    updated_at: (r.updated_at as string | null) ?? null,
  };
}

export async function listExpenses(input?: {
  from?: string;
  to?: string;
  schoolId?: string;
  busId?: string;
}): Promise<Expense[]> {
  const supabase = await createClient();
  let q = supabase
    .from("expenses")
    .select(EXPENSE_SELECT)
    .order("spent_on", { ascending: false });
  if (input?.from) q = q.gte("spent_on", input.from);
  if (input?.to) q = q.lte("spent_on", input.to);
  if (input?.schoolId) q = q.eq("school_id", input.schoolId);
  if (input?.busId) q = q.eq("bus_id", input.busId);
  const { data, error } = await q;
  if (error || !data) {
    // Pre-migration DBs: retry without audit columns so ledger still loads.
    if (error && /updated_by|updated_at/i.test(error.message)) {
      let q2 = supabase
        .from("expenses")
        .select(
          "id, school_id, bus_id, category, title, amount, currency, spent_on, notes, created_by, created_at",
        )
        .order("spent_on", { ascending: false });
      if (input?.from) q2 = q2.gte("spent_on", input.from);
      if (input?.to) q2 = q2.lte("spent_on", input.to);
      if (input?.schoolId) q2 = q2.eq("school_id", input.schoolId);
      if (input?.busId) q2 = q2.eq("bus_id", input.busId);
      const retry = await q2;
      if (retry.error || !retry.data) return [];
      return retry.data.map((r) =>
        mapExpense({ ...r, updated_by: null, updated_at: null }),
      );
    }
    return [];
  }
  return data.map((r) => mapExpense(r as Record<string, unknown>));
}

export async function createExpense(input: {
  schoolId?: string | null;
  busId?: string | null;
  category?: ExpenseCategory;
  title: string;
  amount: number;
  currency?: string;
  spentOn?: string;
  notes?: string | null;
  createdBy?: string | null;
}): Promise<{ expense: Expense } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      school_id: input.schoolId ?? null,
      bus_id: input.busId ?? null,
      category: input.category ?? "other",
      title: input.title.trim(),
      amount: input.amount,
      currency: input.currency ?? "TZS",
      spent_on: input.spentOn ?? new Date().toISOString().slice(0, 10),
      notes: input.notes ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(EXPENSE_SELECT)
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create expense" };
  return { expense: mapExpense(data as Record<string, unknown>) };
}

export async function updateExpense(
  id: string,
  patch: Partial<{
    category: ExpenseCategory;
    title: string;
    amount: number;
    spentOn: string;
    notes: string | null;
    updatedBy: string | null;
  }>,
): Promise<{ expense: Expense } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {
    ...auditUpdatePatch(patch.updatedBy),
  };
  if (patch.category != null) update.category = patch.category;
  if (patch.title != null) update.title = patch.title.trim();
  if (patch.amount != null) update.amount = patch.amount;
  if (patch.spentOn != null) update.spent_on = patch.spentOn;
  if (patch.notes !== undefined) update.notes = patch.notes;

  const { data, error } = await supabase
    .from("expenses")
    .update(update)
    .eq("id", id)
    .select(EXPENSE_SELECT)
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to update expense" };
  return { expense: mapExpense(data as Record<string, unknown>) };
}

export async function deleteExpense(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function listRevenues(input?: {
  from?: string;
  to?: string;
  schoolId?: string;
  busId?: string;
}): Promise<Revenue[]> {
  const supabase = await createClient();
  let q = supabase
    .from("revenues")
    .select(REVENUE_SELECT)
    .order("earned_on", { ascending: false });
  if (input?.from) q = q.gte("earned_on", input.from);
  if (input?.to) q = q.lte("earned_on", input.to);
  if (input?.schoolId) q = q.eq("school_id", input.schoolId);
  if (input?.busId) q = q.eq("bus_id", input.busId);
  const { data, error } = await q;
  if (error || !data) {
    if (error && /updated_by|updated_at/i.test(error.message)) {
      let q2 = supabase
        .from("revenues")
        .select(
          "id, school_id, bus_id, category, title, amount, currency, earned_on, notes, hire_out_id, created_by, created_at",
        )
        .order("earned_on", { ascending: false });
      if (input?.from) q2 = q2.gte("earned_on", input.from);
      if (input?.to) q2 = q2.lte("earned_on", input.to);
      if (input?.schoolId) q2 = q2.eq("school_id", input.schoolId);
      if (input?.busId) q2 = q2.eq("bus_id", input.busId);
      const retry = await q2;
      if (retry.error || !retry.data) return [];
      return retry.data.map((r) =>
        mapRevenue({ ...r, updated_by: null, updated_at: null }),
      );
    }
    return [];
  }
  return data.map((r) => mapRevenue(r as Record<string, unknown>));
}

export async function createRevenue(input: {
  schoolId?: string | null;
  busId?: string | null;
  category?: RevenueCategory;
  title: string;
  amount: number;
  currency?: string;
  earnedOn?: string;
  notes?: string | null;
  hireOutId?: string | null;
  createdBy?: string | null;
}): Promise<{ revenue: Revenue } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("revenues")
    .insert({
      school_id: input.schoolId ?? null,
      bus_id: input.busId ?? null,
      category: input.category ?? "other",
      title: input.title.trim(),
      amount: input.amount,
      currency: input.currency ?? "TZS",
      earned_on: input.earnedOn ?? new Date().toISOString().slice(0, 10),
      notes: input.notes ?? null,
      hire_out_id: input.hireOutId ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(REVENUE_SELECT)
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create revenue" };
  return { revenue: mapRevenue(data as Record<string, unknown>) };
}

export async function updateRevenue(
  id: string,
  patch: Partial<{
    category: RevenueCategory;
    title: string;
    amount: number;
    earnedOn: string;
    notes: string | null;
    updatedBy: string | null;
  }>,
): Promise<{ revenue: Revenue } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {
    ...auditUpdatePatch(patch.updatedBy),
  };
  if (patch.category != null) update.category = patch.category;
  if (patch.title != null) update.title = patch.title.trim();
  if (patch.amount != null) update.amount = patch.amount;
  if (patch.earnedOn != null) update.earned_on = patch.earnedOn;
  if (patch.notes !== undefined) update.notes = patch.notes;

  const { data, error } = await supabase
    .from("revenues")
    .update(update)
    .eq("id", id)
    .select(REVENUE_SELECT)
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to update revenue" };
  return { revenue: mapRevenue(data as Record<string, unknown>) };
}

export async function deleteRevenue(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("revenues").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function listHireOuts(input?: {
  from?: string;
  to?: string;
  busId?: string;
}): Promise<HireOut[]> {
  const supabase = await createClient();
  let q = supabase
    .from("hire_outs")
    .select(
      `
      id, bus_id, school_id, client_name, purpose, start_at, end_at,
      quoted_amount, currency, status, notes, revenue_id, created_by, created_at,
      buses ( label )
    `,
    )
    .order("start_at", { ascending: false });
  if (input?.busId) q = q.eq("bus_id", input.busId);
  if (input?.from) q = q.gte("end_at", input.from);
  if (input?.to) q = q.lte("start_at", input.to);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map((row) => {
    const bus = Array.isArray(row.buses) ? row.buses[0] : row.buses;
    return {
      id: row.id,
      bus_id: row.bus_id,
      school_id: row.school_id,
      client_name: row.client_name,
      purpose: row.purpose as HirePurpose,
      start_at: row.start_at,
      end_at: row.end_at,
      quoted_amount: num(row.quoted_amount),
      currency: row.currency,
      status: row.status as HireStatus,
      notes: row.notes,
      revenue_id: row.revenue_id,
      created_by: row.created_by,
      created_at: row.created_at,
      bus_label: bus?.label ?? "",
    };
  });
}

export async function createHireOut(input: {
  busId: string;
  schoolId?: string | null;
  clientName: string;
  purpose?: HirePurpose;
  startAt: string;
  endAt: string;
  quotedAmount?: number;
  currency?: string;
  status?: HireStatus;
  notes?: string | null;
  createdBy?: string | null;
  createRevenue?: boolean;
}): Promise<{ hire_out: HireOut; revenue?: Revenue } | { error: string }> {
  const supabase = await createClient();

  // Overlap check: same bus, overlapping active bookings
  const { data: conflicts } = await supabase
    .from("hire_outs")
    .select("id, client_name, start_at, end_at")
    .eq("bus_id", input.busId)
    .in("status", ["booked", "in_progress"])
    .lt("start_at", input.endAt)
    .gt("end_at", input.startAt);

  if (conflicts && conflicts.length > 0) {
    return {
      error: `Bus already hired out (${conflicts[0].client_name}) overlapping this window`,
    };
  }

  const { data, error } = await supabase
    .from("hire_outs")
    .insert({
      bus_id: input.busId,
      school_id: input.schoolId ?? null,
      client_name: input.clientName.trim(),
      purpose: input.purpose ?? "event",
      start_at: input.startAt,
      end_at: input.endAt,
      quoted_amount: input.quotedAmount ?? 0,
      currency: input.currency ?? "TZS",
      status: input.status ?? "booked",
      notes: input.notes ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(
      "id, bus_id, school_id, client_name, purpose, start_at, end_at, quoted_amount, currency, status, notes, revenue_id, created_by, created_at",
    )
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Failed to create hire-out" };
  }

  const hire_out: HireOut = {
    ...data,
    purpose: data.purpose as HirePurpose,
    status: data.status as HireStatus,
    quoted_amount: num(data.quoted_amount),
  };

  let revenue: Revenue | undefined;
  if (input.createRevenue && (input.quotedAmount ?? 0) > 0) {
    const rev = await createRevenue({
      schoolId: input.schoolId,
      busId: input.busId,
      category: "hire_out",
      title: `Hire-out: ${input.clientName.trim()}`,
      amount: input.quotedAmount ?? 0,
      currency: input.currency,
      earnedOn: input.startAt.slice(0, 10),
      hireOutId: data.id,
      createdBy: input.createdBy,
    });
    if ("revenue" in rev) {
      revenue = rev.revenue;
      await supabase
        .from("hire_outs")
        .update({ revenue_id: rev.revenue.id })
        .eq("id", data.id);
      hire_out.revenue_id = rev.revenue.id;
    }
  }

  return { hire_out, revenue };
}

export async function updateHireOut(
  id: string,
  patch: Partial<{
    status: HireStatus;
    notes: string | null;
    quotedAmount: number;
    startAt: string;
    endAt: string;
  }>,
): Promise<{ hire_out: HireOut } | { error: string }> {
  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("hire_outs")
    .select("status, revenue_id")
    .eq("id", id)
    .single();
  if (fetchError || !existing) {
    return { error: fetchError?.message ?? "Hire-out not found" };
  }

  const update: Record<string, unknown> = {};
  if (patch.status != null) update.status = patch.status;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.quotedAmount != null) update.quoted_amount = patch.quotedAmount;
  if (patch.startAt != null) update.start_at = patch.startAt;
  if (patch.endAt != null) update.end_at = patch.endAt;

  const cancelling = patch.status === "cancelled" && existing.status !== "cancelled";
  const reactivating = patch.status != null && patch.status !== "cancelled" && existing.status === "cancelled";

  // Cancelling a booking means the money was never earned — drop the linked
  // revenue instead of leaving it to keep counting in every P&L/report.
  if (cancelling && existing.revenue_id) {
    await deleteRevenue(existing.revenue_id);
    update.revenue_id = null;
  }

  const { data, error } = await supabase
    .from("hire_outs")
    .update(update)
    .eq("id", id)
    .select(
      "id, bus_id, school_id, client_name, purpose, start_at, end_at, quoted_amount, currency, status, notes, revenue_id, created_by, created_at",
    )
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to update hire-out" };

  let hire_out: HireOut = {
    ...data,
    purpose: data.purpose as HirePurpose,
    status: data.status as HireStatus,
    quoted_amount: num(data.quoted_amount),
  };

  // Reactivating a previously-cancelled booking should bring its revenue
  // back, since the fee is expected to be earned again.
  if (reactivating && !hire_out.revenue_id && hire_out.quoted_amount > 0) {
    const rev = await createRevenue({
      schoolId: hire_out.school_id,
      busId: hire_out.bus_id,
      category: "hire_out",
      title: `Hire-out: ${hire_out.client_name}`,
      amount: hire_out.quoted_amount,
      currency: hire_out.currency,
      earnedOn: hire_out.start_at.slice(0, 10),
      hireOutId: hire_out.id,
      createdBy: hire_out.created_by,
    });
    if ("revenue" in rev) {
      await supabase.from("hire_outs").update({ revenue_id: rev.revenue.id }).eq("id", id);
      hire_out = { ...hire_out, revenue_id: rev.revenue.id };
    }
  }

  return { hire_out };
}

export async function listBudgets(input?: {
  schoolId?: string;
  busId?: string;
  activeOn?: string;
}): Promise<Budget[]> {
  const supabase = await createClient();
  let q = supabase
    .from("budgets")
    .select(BUDGET_SELECT)
    .order("period_start", { ascending: false });
  if (input?.schoolId) q = q.eq("school_id", input.schoolId);
  if (input?.busId) q = q.eq("bus_id", input.busId);
  if (input?.activeOn) {
    q = q.lte("period_start", input.activeOn).gte("period_end", input.activeOn);
  }
  const { data, error } = await q;
  if (!error && data) {
    return data.map((r) => mapBudget(r as Record<string, unknown>));
  }
  if (!isMissingBusIdError(error)) return [];

  // bus_id column doesn't exist live yet -- drop it from the select and the
  // filter and retry.
  let q2 = supabase
    .from("budgets")
    .select(BUDGET_COLUMNS_NO_BUS_ID)
    .order("period_start", { ascending: false });
  if (input?.schoolId) q2 = q2.eq("school_id", input.schoolId);
  if (input?.activeOn) {
    q2 = q2.lte("period_start", input.activeOn).gte("period_end", input.activeOn);
  }
  const retry = await q2;
  if (retry.error || !retry.data) return [];
  return retry.data.map((r) => mapBudget({ ...r, bus_id: null }));
}

export async function createBudget(input: {
  schoolId?: string | null;
  busId?: string | null;
  name: string;
  category?: BudgetCategory;
  periodStart: string;
  periodEnd: string;
  amount: number;
  currency?: string;
  notes?: string | null;
  createdBy?: string | null;
}): Promise<{ budget: Budget } | { error: string }> {
  const supabase = await createClient();
  const row = {
    school_id: input.schoolId ?? null,
    bus_id: input.busId ?? null,
    name: input.name.trim(),
    category: input.category ?? "ops",
    period_start: input.periodStart,
    period_end: input.periodEnd,
    amount: input.amount,
    currency: input.currency ?? "TZS",
    notes: input.notes ?? null,
    created_by: input.createdBy ?? null,
  };
  const { data, error } = await supabase
    .from("budgets")
    .insert(row)
    .select(BUDGET_SELECT)
    .single();
  if (!error && data) {
    return { budget: mapBudget(data as Record<string, unknown>) };
  }
  if (!isMissingBusIdError(error)) {
    return { error: error?.message ?? "Failed to create budget" };
  }

  // bus_id column doesn't exist live yet -- the budget still gets created,
  // just not bus-scoped, until the migration runs.
  const { bus_id: _droppedBusId, ...rowWithoutBusId } = row;
  const retry = await supabase
    .from("budgets")
    .insert(rowWithoutBusId)
    .select(BUDGET_COLUMNS_NO_BUS_ID)
    .single();
  if (retry.error || !retry.data) {
    return { error: retry.error?.message ?? "Failed to create budget" };
  }
  return { budget: mapBudget({ ...retry.data, bus_id: null }) };
}

export async function updateBudget(
  id: string,
  patch: Partial<{
    name: string;
    category: BudgetCategory;
    periodStart: string;
    periodEnd: string;
    amount: number;
    schoolId: string | null;
    busId: string | null;
    notes: string | null;
    updatedBy: string | null;
  }>,
): Promise<{ budget: Budget } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {
    ...auditUpdatePatch(patch.updatedBy),
  };
  if (patch.name != null) update.name = patch.name.trim();
  if (patch.category != null) update.category = patch.category;
  if (patch.periodStart != null) update.period_start = patch.periodStart;
  if (patch.periodEnd != null) update.period_end = patch.periodEnd;
  if (patch.amount != null) update.amount = patch.amount;
  if (patch.schoolId !== undefined) update.school_id = patch.schoolId;
  if (patch.busId !== undefined) update.bus_id = patch.busId;
  if (patch.notes !== undefined) update.notes = patch.notes;

  const { data, error } = await supabase
    .from("budgets")
    .update(update)
    .eq("id", id)
    .select(BUDGET_SELECT)
    .single();
  if (!error && data) {
    return { budget: mapBudget(data as Record<string, unknown>) };
  }
  if (!isMissingBusIdError(error)) {
    return { error: error?.message ?? "Failed to update budget" };
  }

  // bus_id column doesn't exist live yet -- retry without touching it.
  const { bus_id: _droppedBusId, ...updateWithoutBusId } = update;
  const retry = await supabase
    .from("budgets")
    .update(updateWithoutBusId)
    .eq("id", id)
    .select(BUDGET_COLUMNS_NO_BUS_ID)
    .single();
  if (retry.error || !retry.data) {
    return { error: retry.error?.message ?? "Failed to update budget" };
  }
  return { budget: mapBudget({ ...retry.data, bus_id: null }) };
}

export async function deleteBudget(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("budgets").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Budget not found or not permitted" };
  return { ok: true };
}

/** Day 14 — period P&L + budget burn */
export async function getPeriodPnL(input: {
  from: string;
  to: string;
  schoolId?: string;
}): Promise<PnLReport> {
  const [allExpenses, revenues, budgets, hireOuts] = await Promise.all([
    listExpenses({ schoolId: input.schoolId }),
    listRevenues({ from: input.from, to: input.to, schoolId: input.schoolId }),
    listBudgets({ schoolId: input.schoolId }),
    listHireOuts({ from: input.from, to: input.to }),
  ]);

  const expenses = allExpenses.filter(
    (e) => e.spent_on >= input.from && e.spent_on <= input.to,
  );

  const revenue_by_category: Record<string, number> = {};
  const expense_by_category: Record<string, number> = {};
  let total_revenue = 0;
  let total_expense = 0;

  for (const r of revenues) {
    total_revenue += r.amount;
    revenue_by_category[r.category] =
      (revenue_by_category[r.category] ?? 0) + r.amount;
  }
  for (const e of expenses) {
    total_expense += e.amount;
    expense_by_category[e.category] =
      (expense_by_category[e.category] ?? 0) + e.amount;
  }

  const overlappingBudgets = budgets.filter(
    (b) => b.period_start <= input.to && b.period_end >= input.from,
  );

  const budgetRows = overlappingBudgets.map((b) => {
    // Budget burn is computed against the budget's own period (not the
    // report's from/to window — a budget can span more than one month) and
    // its own scope (bus, else campus, else fleet-wide) via the shared
    // budgetMatchesExpense — same rule the Ledger UI's pre-submit warning
    // uses, so the two can't silently disagree again.
    const spent = allExpenses
      .filter((e) => budgetMatchesExpense(b, e))
      .reduce((s, e) => s + e.amount, 0);
    const remaining = b.amount - spent;
    const burn_pct = b.amount > 0 ? Math.round((spent / b.amount) * 1000) / 10 : 0;
    return {
      id: b.id,
      name: b.name,
      category: b.category,
      budget_amount: b.amount,
      spent,
      remaining,
      burn_pct,
    };
  });

  return {
    from: input.from,
    to: input.to,
    currency: "TZS",
    total_revenue,
    total_expense,
    net: total_revenue - total_expense,
    revenue_by_category,
    expense_by_category,
    budgets: budgetRows,
    hire_outs_in_period: hireOuts.length,
    hire_out_quoted: hireOuts.reduce((s, h) => s + h.quoted_amount, 0),
  };
}
