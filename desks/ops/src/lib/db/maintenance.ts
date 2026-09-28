import { createClient } from "@/lib/supabase/server";

export type MaintenanceCategory =
  | "service"
  | "repair"
  | "tyre"
  | "fuel_system"
  | "body"
  | "inspection"
  | "other";

export type MaintenanceStatus = "open" | "in_progress" | "done" | "cancelled";

export type MaintenanceRecord = {
  id: string;
  bus_id: string | null;
  title: string;
  category: MaintenanceCategory;
  status: MaintenanceStatus;
  cost: number;
  budget_amount: number | null;
  currency: string;
  notes: string | null;
  service_date: string | null;
  due_date: string | null;
  expense_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  bus_label?: string;
  /** Garage/supplier name -- for a per-vendor spend rollup, same idea as the
   * source sheet's "Suply/Supplier" column. Null = not recorded. */
  vendor_name: string | null;
  /** VAT split out from material cost -- both null = not recorded, not zero. */
  vat_amount: number | null;
  /** Labour charge, separate from itemized parts cost. */
  labour_cost: number | null;
};

// vendor_name/vat_amount/labour_cost pending schema_maintenance.sql migration
// -- do not add to this select until the columns exist live (an unknown
// column fails the whole query, and this list feeds the Maintenance page,
// bus detail page, dashboard, and compliance checks).
const MAINTENANCE_COLUMNS = `id, bus_id, title, category, status, cost, budget_amount, currency, notes,
       service_date, due_date, expense_id, created_by, created_at, updated_at`;

function mapMaintenanceRow(
  row: Record<string, unknown> & {
    cost: number | string;
    budget_amount?: number | string | null;
    vat_amount?: number | string | null;
    labour_cost?: number | string | null;
    category: string;
    status: string;
    buses?: { label: string } | { label: string }[] | null;
  },
): MaintenanceRecord {
  const bus = Array.isArray(row.buses) ? row.buses[0] : row.buses;
  return {
    id: row.id as string,
    bus_id: (row.bus_id as string | null) ?? null,
    title: row.title as string,
    category: row.category as MaintenanceCategory,
    status: row.status as MaintenanceStatus,
    cost: Number(row.cost),
    budget_amount:
      row.budget_amount == null || row.budget_amount === ""
        ? null
        : Number(row.budget_amount),
    currency: row.currency as string,
    notes: (row.notes as string | null) ?? null,
    service_date: (row.service_date as string | null) ?? null,
    due_date: (row.due_date as string | null) ?? null,
    expense_id: (row.expense_id as string | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    bus_label: bus?.label ?? undefined,
    vendor_name: (row.vendor_name as string | null) ?? null,
    vat_amount:
      row.vat_amount == null || row.vat_amount === "" ? null : Number(row.vat_amount),
    labour_cost:
      row.labour_cost == null || row.labour_cost === "" ? null : Number(row.labour_cost),
  };
}

export async function listMaintenance(busId?: string): Promise<MaintenanceRecord[]> {
  const supabase = await createClient();
  let q = supabase
    .from("maintenance_records")
    .select(`${MAINTENANCE_COLUMNS}, buses ( label )`)
    .order("created_at", { ascending: false });
  if (busId) q = q.eq("bus_id", busId);

  const { data, error } = await q;
  if (error || !data) return [];

  return data.map((row) => mapMaintenanceRow(row));
}

export async function createMaintenance(input: {
  busId?: string | null;
  title: string;
  category?: MaintenanceCategory;
  status?: MaintenanceStatus;
  cost?: number;
  budgetAmount?: number | null;
  currency?: string;
  notes?: string | null;
  serviceDate?: string | null;
  dueDate?: string | null;
  expenseId?: string | null;
  createdBy?: string | null;
  vendorName?: string | null;
  vatAmount?: number | null;
  labourCost?: number | null;
}): Promise<{ record: MaintenanceRecord } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maintenance_records")
    .insert({
      bus_id: input.busId ?? null,
      title: input.title.trim(),
      category: input.category ?? "repair",
      status: input.status ?? "open",
      cost: input.cost ?? 0,
      budget_amount: input.budgetAmount ?? null,
      currency: input.currency ?? "TZS",
      notes: input.notes ?? null,
      service_date: input.serviceDate ?? null,
      due_date: input.dueDate ?? null,
      expense_id: input.expenseId ?? null,
      created_by: input.createdBy ?? null,
      // vendor_name/vat_amount/labour_cost pending schema_maintenance.sql
      // migration -- not written yet.
    })
    .select(MAINTENANCE_COLUMNS)
    .single();

  if (error || !data) {
    // schema_maintenance.sql's "alter column bus_id drop not null" migration
    // (for fleet-wide charges like "Labour charges") is written but not yet
    // applied live (confirmed 2026-08-19) -- a null busId still hits a real
    // NOT NULL violation (23502) rather than failing to parse a column, so
    // the usual missing-column retry pattern doesn't apply here. Translate
    // the raw constraint error into something an admin can actually act on.
    if (input.busId == null && error?.code === "23502" && /bus_id/i.test(error.message)) {
      return {
        error:
          "Fleet-wide maintenance records aren't enabled yet -- ask Kai to run the pending bus_id migration, or pick a specific bus for now.",
      };
    }
    return { error: error?.message ?? "Failed to create maintenance record" };
  }

  return { record: mapMaintenanceRow(data) };
}

export async function updateMaintenance(
  id: string,
  patch: Partial<{
    title: string;
    category: MaintenanceCategory;
    status: MaintenanceStatus;
    cost: number;
    budgetAmount: number | null;
    notes: string | null;
    serviceDate: string | null;
    dueDate: string | null;
    expenseId: string | null;
    vendorName: string | null;
    vatAmount: number | null;
    labourCost: number | null;
  }>,
): Promise<{ record: MaintenanceRecord } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.title != null) update.title = patch.title.trim();
  if (patch.category != null) update.category = patch.category;
  if (patch.status != null) update.status = patch.status;
  if (patch.cost != null) update.cost = patch.cost;
  if (patch.budgetAmount !== undefined) update.budget_amount = patch.budgetAmount;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.serviceDate !== undefined) update.service_date = patch.serviceDate;
  if (patch.dueDate !== undefined) update.due_date = patch.dueDate;
  if (patch.expenseId !== undefined) update.expense_id = patch.expenseId;
  // vendorName/vatAmount/labourCost pending schema_maintenance.sql migration
  // -- not written yet.

  const { data, error } = await supabase
    .from("maintenance_records")
    .update(update)
    .eq("id", id)
    .select(MAINTENANCE_COLUMNS)
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Failed to update maintenance" };
  }

  return { record: mapMaintenanceRow(data) };
}

export async function deleteMaintenance(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("maintenance_records")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}
