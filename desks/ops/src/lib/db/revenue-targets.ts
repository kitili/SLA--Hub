import { createClient } from "@/lib/supabase/server";
import type { RevenueCategory } from "@/lib/db/finance";

export type RevenueTarget = {
  id: string;
  school_id: string | null;
  bus_id: string | null;
  category: RevenueCategory;
  name: string;
  period_start: string;
  period_end: string;
  amount: number;
  currency: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// revenue_targets is a brand-new table (schema_week3.sql) not yet applied
// live -- until it is, every write fails with a raw "table not found in
// schema cache" error. Translate that into something an admin can act on
// instead of a confusing Postgres/PostgREST message.
function friendlyError(
  error: { code?: string; message: string } | null,
  fallback: string,
): string {
  if (error?.code === "PGRST205" || error?.message?.includes("Could not find the table")) {
    return "Revenue targets aren't set up in the database yet -- this needs a pending migration to be applied first.";
  }
  return error?.message ?? fallback;
}

const REVENUE_TARGET_COLUMNS =
  "id, school_id, bus_id, category, name, period_start, period_end, amount, currency, notes, created_by, created_at";

export async function listRevenueTargets(input?: {
  schoolId?: string;
  busId?: string;
  activeOn?: string;
}): Promise<RevenueTarget[]> {
  const supabase = await createClient();
  let q = supabase
    .from("revenue_targets")
    .select(REVENUE_TARGET_COLUMNS)
    .order("period_start", { ascending: false });
  if (input?.schoolId) q = q.eq("school_id", input.schoolId);
  if (input?.busId) q = q.eq("bus_id", input.busId);
  if (input?.activeOn) {
    q = q.lte("period_start", input.activeOn).gte("period_end", input.activeOn);
  }
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map((r) => ({
    ...r,
    amount: num(r.amount),
    category: r.category as RevenueCategory,
  }));
}

export async function createRevenueTarget(input: {
  schoolId?: string | null;
  busId?: string | null;
  category?: RevenueCategory;
  name: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  currency?: string;
  notes?: string | null;
  createdBy?: string | null;
}): Promise<{ target: RevenueTarget } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("revenue_targets")
    .insert({
      school_id: input.schoolId ?? null,
      bus_id: input.busId ?? null,
      category: input.category ?? "transport_fees",
      name: input.name.trim(),
      period_start: input.periodStart,
      period_end: input.periodEnd,
      amount: input.amount,
      currency: input.currency ?? "TZS",
      notes: input.notes ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(REVENUE_TARGET_COLUMNS)
    .single();
  if (error || !data) {
    return { error: friendlyError(error, "Failed to create revenue target") };
  }
  return {
    target: { ...data, amount: num(data.amount), category: data.category as RevenueCategory },
  };
}

export async function updateRevenueTarget(
  id: string,
  patch: Partial<{
    name: string;
    category: RevenueCategory;
    periodStart: string;
    periodEnd: string;
    amount: number;
    schoolId: string | null;
    busId: string | null;
    notes: string | null;
  }>,
): Promise<{ target: RevenueTarget } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.name != null) update.name = patch.name.trim();
  if (patch.category != null) update.category = patch.category;
  if (patch.periodStart != null) update.period_start = patch.periodStart;
  if (patch.periodEnd != null) update.period_end = patch.periodEnd;
  if (patch.amount != null) update.amount = patch.amount;
  if (patch.schoolId !== undefined) update.school_id = patch.schoolId;
  if (patch.busId !== undefined) update.bus_id = patch.busId;
  if (patch.notes !== undefined) update.notes = patch.notes;

  const { data, error } = await supabase
    .from("revenue_targets")
    .update(update)
    .eq("id", id)
    .select(REVENUE_TARGET_COLUMNS)
    .single();
  if (error || !data) {
    return { error: friendlyError(error, "Failed to update revenue target") };
  }
  return {
    target: { ...data, amount: num(data.amount), category: data.category as RevenueCategory },
  };
}

export async function deleteRevenueTarget(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("revenue_targets").delete().eq("id", id);
  if (error) return { error: friendlyError(error, "Failed to delete revenue target") };
  return { ok: true };
}
