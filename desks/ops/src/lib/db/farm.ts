import { createClient } from "@/lib/supabase/server";
import { notifyAdminSms } from "@/lib/messaging/admin-alert";

export type PlotStatus = "fallow" | "staged" | "active" | "retired";
export type PlantingStatus = "planned" | "planted" | "growing" | "harvested" | "failed";
export type ActivityType =
  | "prep" | "plant" | "weed" | "inspect" | "fertilize" | "irrigate" | "harvest" | "other";
export type ActivityStatus = "pending" | "in_progress" | "done" | "skipped";
export type FarmExpenseCategory =
  | "seed" | "fertilizer" | "labor" | "tools" | "irrigation" | "pest_control" | "other";
export type FarmBudgetCategory = FarmExpenseCategory | "all";
export type HarvestDestination = "kitchen" | "sold" | "seed_stock" | "waste" | "other";
export type FarmAlertKind = "activity_overdue" | "budget_overrun" | "low_stock";
export type FarmScheduleStage =
  | "ON"
  | "OFF"
  | "FPR"
  | "PLT"
  | "WDN"
  | "INS"
  | "FTL"
  | "HVT";

export type FarmPlot = {
  id: string;
  code: string;
  name: string | null;
  acreage: number;
  location: string | null;
  lat: number | null;
  lng: number | null;
  status: PlotStatus;
  notes: string | null;
  created_at: string;
};

export type FarmPlotSection = {
  id: string;
  plot_id: string;
  code: string;
  name: string | null;
  acreage: number | null;
  notes: string | null;
  created_at: string;
  plot_code?: string;
};

export type FarmScheduleWeek = {
  id: string;
  section_id: string;
  week_of: string;
  stage_code: FarmScheduleStage;
  notes: string | null;
  created_at: string;
  section_code?: string;
  plot_code?: string;
  crop?: string | null;
};

export type FarmCropPlanting = {
  id: string;
  plot_id: string;
  crop: string;
  season: string | null;
  planted_on: string | null;
  expected_harvest_on: string | null;
  target_yield_kg: number | null;
  status: PlantingStatus;
  notes: string | null;
  created_at: string;
  plot_code?: string;
};

export type FarmActivity = {
  id: string;
  plot_id: string | null;
  planting_id: string | null;
  activity_type: ActivityType;
  title: string;
  due_on: string | null;
  assignee: string | null;
  status: ActivityStatus;
  completed_at: string | null;
  alert_sent_at: string | null;
  notes: string | null;
  created_at: string;
  plot_code?: string;
};

export type FarmInput = {
  id: string;
  name: string;
  unit: string;
  quantity_on_hand: number;
  reorder_threshold: number;
  last_restocked_on: string | null;
  notes: string | null;
  created_at: string;
};

export type FarmExpense = {
  id: string;
  category: FarmExpenseCategory;
  amount: number;
  currency: string;
  spent_on: string;
  plot_id: string | null;
  planting_id: string | null;
  input_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type FarmBudget = {
  id: string;
  category: FarmBudgetCategory;
  period: string;
  planned_amount: number;
  currency: string;
  notes: string | null;
  created_at: string;
};

export type FarmHarvest = {
  id: string;
  planting_id: string | null;
  plot_id: string;
  harvested_on: string;
  quantity_kg: number;
  value_amount: number | null;
  currency: string;
  destination: HarvestDestination;
  photo_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type FarmWalkthrough = {
  id: string;
  week_of: string;
  plot_id: string | null;
  checklist: Record<string, unknown>;
  overall_score: number | null;
  photo_url: string | null;
  notes: string | null;
  reviewed_by: string | null;
  created_at: string;
};

export type FarmAlert = {
  id: string;
  kind: FarmAlertKind;
  activity_id: string | null;
  budget_id: string | null;
  input_id: string | null;
  message: string;
  status: "open" | "notified" | "acked";
  created_at: string;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------
// Plots
// ---------------------------------------------------------------------------

export async function listPlots(): Promise<FarmPlot[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("farm_plots")
    .select("id, code, name, acreage, location, lat, lng, status, notes, created_at")
    .order("code", { ascending: true });
  if (error || !data) {
    // Older DBs without lat/lng columns
    const fallback = await supabase
      .from("farm_plots")
      .select("id, code, name, acreage, location, status, notes, created_at")
      .order("code", { ascending: true });
    if (fallback.error || !fallback.data) return [];
    return fallback.data.map((r) => ({
      ...r,
      acreage: num(r.acreage),
      lat: null,
      lng: null,
    }));
  }
  return data.map((r) => ({
    ...r,
    acreage: num(r.acreage),
    lat: r.lat != null ? num(r.lat) : null,
    lng: r.lng != null ? num(r.lng) : null,
  }));
}

export async function listPlotSections(): Promise<FarmPlotSection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("farm_plot_sections")
    .select("id, plot_id, code, name, acreage, notes, created_at, farm_plots(code)")
    .order("code", { ascending: true });
  if (error || !data) return [];
  return data.map((r) => {
    const plot = r.farm_plots as { code?: string } | { code?: string }[] | null;
    const plotCode = Array.isArray(plot) ? plot[0]?.code : plot?.code;
    return {
      id: r.id,
      plot_id: r.plot_id,
      code: r.code,
      name: r.name,
      acreage: r.acreage != null ? num(r.acreage) : null,
      notes: r.notes,
      created_at: r.created_at,
      plot_code: plotCode,
    };
  });
}

export async function listScheduleWeeks(input?: {
  from?: string;
  to?: string;
}): Promise<FarmScheduleWeek[]> {
  const supabase = await createClient();
  let q = supabase
    .from("farm_schedule_weeks")
    .select(
      "id, section_id, week_of, stage_code, notes, created_at, farm_plot_sections(code, name, farm_plots(code))",
    )
    .order("week_of", { ascending: true });
  if (input?.from) q = q.gte("week_of", input.from);
  if (input?.to) q = q.lte("week_of", input.to);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map((r) => {
    const section = r.farm_plot_sections as
      | {
          code?: string;
          name?: string | null;
          farm_plots?: { code?: string } | { code?: string }[] | null;
        }
      | {
          code?: string;
          name?: string | null;
          farm_plots?: { code?: string } | { code?: string }[] | null;
        }[]
      | null;
    const sectionRow = Array.isArray(section) ? section[0] : section;
    const plot = sectionRow?.farm_plots;
    const plotCode = Array.isArray(plot) ? plot[0]?.code : plot?.code;
    return {
      id: r.id,
      section_id: r.section_id,
      week_of: r.week_of,
      stage_code: r.stage_code as FarmScheduleStage,
      notes: r.notes,
      created_at: r.created_at,
      section_code: sectionRow?.code,
      plot_code: plotCode,
      crop: sectionRow?.name ?? null,
    };
  });
}

const SCHEDULE_STAGES: FarmScheduleStage[] = [
  "ON",
  "OFF",
  "FPR",
  "PLT",
  "WDN",
  "INS",
  "FTL",
  "HVT",
];

/** Upsert one planned week cell — Ops is the live farming schedule sheet. */
export async function upsertScheduleWeek(input: {
  sectionId: string;
  weekOf: string;
  stageCode: FarmScheduleStage;
  notes?: string | null;
}): Promise<{ week: FarmScheduleWeek } | { error: string }> {
  if (!SCHEDULE_STAGES.includes(input.stageCode)) {
    return { error: "Invalid stage code" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("farm_schedule_weeks")
    .upsert(
      {
        section_id: input.sectionId,
        week_of: input.weekOf,
        stage_code: input.stageCode,
        notes: input.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "section_id,week_of" },
    )
    .select(
      "id, section_id, week_of, stage_code, notes, created_at, farm_plot_sections(code, name, farm_plots(code))",
    )
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to save schedule week" };
  }
  const section = data.farm_plot_sections as
    | {
        code?: string;
        name?: string | null;
        farm_plots?: { code?: string } | { code?: string }[] | null;
      }
    | {
        code?: string;
        name?: string | null;
        farm_plots?: { code?: string } | { code?: string }[] | null;
      }[]
    | null;
  const sectionRow = Array.isArray(section) ? section[0] : section;
  const plot = sectionRow?.farm_plots;
  const plotCode = Array.isArray(plot) ? plot[0]?.code : plot?.code;
  return {
    week: {
      id: data.id,
      section_id: data.section_id,
      week_of: data.week_of,
      stage_code: data.stage_code as FarmScheduleStage,
      notes: data.notes,
      created_at: data.created_at,
      section_code: sectionRow?.code,
      plot_code: plotCode,
      crop: sectionRow?.name ?? null,
    },
  };
}

export async function createPlot(input: {
  code: string;
  name?: string | null;
  acreage?: number;
  location?: string | null;
  status?: PlotStatus;
  notes?: string | null;
}): Promise<{ plot: FarmPlot } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("farm_plots")
    .insert({
      code: input.code.trim(),
      name: input.name ?? null,
      acreage: input.acreage ?? 0,
      location: input.location ?? null,
      status: input.status ?? "fallow",
      notes: input.notes ?? null,
    })
    .select("id, code, name, acreage, location, status, notes, created_at")
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create plot" };
  return { plot: { ...data, acreage: num(data.acreage), lat: null, lng: null } };
}

export async function updatePlot(
  id: string,
  patch: Partial<{
    name: string | null;
    acreage: number;
    location: string | null;
    status: PlotStatus;
    notes: string | null;
  }>,
): Promise<{ plot: FarmPlot } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("farm_plots")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, code, name, acreage, location, status, notes, created_at")
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to update plot" };
  return { plot: { ...data, acreage: num(data.acreage), lat: null, lng: null } };
}

export async function deletePlot(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("farm_plots").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Crop plantings
// ---------------------------------------------------------------------------

export async function listCropPlantings(input?: {
  plotId?: string;
  season?: string;
  status?: PlantingStatus;
}): Promise<FarmCropPlanting[]> {
  const supabase = await createClient();
  let q = supabase
    .from("farm_crop_plantings")
    .select(
      "id, plot_id, crop, season, planted_on, expected_harvest_on, target_yield_kg, status, notes, created_at, farm_plots ( code )",
    )
    .order("created_at", { ascending: false });
  if (input?.plotId) q = q.eq("plot_id", input.plotId);
  if (input?.season) q = q.eq("season", input.season);
  if (input?.status) q = q.eq("status", input.status);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map((row) => {
    const plot = Array.isArray(row.farm_plots) ? row.farm_plots[0] : row.farm_plots;
    return {
      id: row.id,
      plot_id: row.plot_id,
      crop: row.crop,
      season: row.season,
      planted_on: row.planted_on,
      expected_harvest_on: row.expected_harvest_on,
      target_yield_kg: row.target_yield_kg != null ? num(row.target_yield_kg) : null,
      status: row.status as PlantingStatus,
      notes: row.notes,
      created_at: row.created_at,
      plot_code: plot?.code,
    };
  });
}

export async function createCropPlanting(input: {
  plotId: string;
  crop: string;
  season?: string | null;
  plantedOn?: string | null;
  expectedHarvestOn?: string | null;
  targetYieldKg?: number | null;
  status?: PlantingStatus;
  notes?: string | null;
}): Promise<{ planting: FarmCropPlanting } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("farm_crop_plantings")
    .insert({
      plot_id: input.plotId,
      crop: input.crop.trim(),
      season: input.season ?? null,
      planted_on: input.plantedOn ?? null,
      expected_harvest_on: input.expectedHarvestOn ?? null,
      target_yield_kg: input.targetYieldKg ?? null,
      status: input.status ?? "planned",
      notes: input.notes ?? null,
    })
    .select(
      "id, plot_id, crop, season, planted_on, expected_harvest_on, target_yield_kg, status, notes, created_at",
    )
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create planting" };
  return {
    planting: {
      ...data,
      target_yield_kg: data.target_yield_kg != null ? num(data.target_yield_kg) : null,
      status: data.status as PlantingStatus,
    },
  };
}

export async function updateCropPlanting(
  id: string,
  patch: Partial<{
    status: PlantingStatus;
    plantedOn: string | null;
    expectedHarvestOn: string | null;
    targetYieldKg: number | null;
    notes: string | null;
  }>,
): Promise<{ planting: FarmCropPlanting } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.status != null) update.status = patch.status;
  if (patch.plantedOn !== undefined) update.planted_on = patch.plantedOn;
  if (patch.expectedHarvestOn !== undefined) update.expected_harvest_on = patch.expectedHarvestOn;
  if (patch.targetYieldKg !== undefined) update.target_yield_kg = patch.targetYieldKg;
  if (patch.notes !== undefined) update.notes = patch.notes;

  const { data, error } = await supabase
    .from("farm_crop_plantings")
    .update(update)
    .eq("id", id)
    .select(
      "id, plot_id, crop, season, planted_on, expected_harvest_on, target_yield_kg, status, notes, created_at",
    )
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to update planting" };
  return {
    planting: {
      ...data,
      target_yield_kg: data.target_yield_kg != null ? num(data.target_yield_kg) : null,
      status: data.status as PlantingStatus,
    },
  };
}

export async function deleteCropPlanting(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("farm_crop_plantings").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Activities / schedule
// ---------------------------------------------------------------------------

export async function listActivities(input?: {
  plotId?: string;
  status?: ActivityStatus;
  dueBefore?: string;
}): Promise<FarmActivity[]> {
  const supabase = await createClient();
  let q = supabase
    .from("farm_activities")
    .select(
      "id, plot_id, planting_id, activity_type, title, due_on, assignee, status, completed_at, alert_sent_at, notes, created_at, farm_plots ( code )",
    )
    .order("due_on", { ascending: true });
  if (input?.plotId) q = q.eq("plot_id", input.plotId);
  if (input?.status) q = q.eq("status", input.status);
  if (input?.dueBefore) q = q.lte("due_on", input.dueBefore);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map((row) => {
    const plot = Array.isArray(row.farm_plots) ? row.farm_plots[0] : row.farm_plots;
    return { ...row, activity_type: row.activity_type as ActivityType, status: row.status as ActivityStatus, plot_code: plot?.code };
  });
}

export async function createActivity(input: {
  plotId?: string | null;
  plantingId?: string | null;
  activityType: ActivityType;
  title: string;
  dueOn?: string | null;
  assignee?: string | null;
  notes?: string | null;
}): Promise<{ activity: FarmActivity } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("farm_activities")
    .insert({
      plot_id: input.plotId ?? null,
      planting_id: input.plantingId ?? null,
      activity_type: input.activityType,
      title: input.title.trim(),
      due_on: input.dueOn ?? null,
      assignee: input.assignee ?? null,
      notes: input.notes ?? null,
    })
    .select(
      "id, plot_id, planting_id, activity_type, title, due_on, assignee, status, completed_at, alert_sent_at, notes, created_at",
    )
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create activity" };
  return { activity: { ...data, activity_type: data.activity_type as ActivityType, status: data.status as ActivityStatus } };
}

export async function updateActivityStatus(
  id: string,
  status: ActivityStatus,
): Promise<{ activity: FarmActivity } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("farm_activities")
    .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
    .eq("id", id)
    .select(
      "id, plot_id, planting_id, activity_type, title, due_on, assignee, status, completed_at, alert_sent_at, notes, created_at",
    )
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to update activity" };
  return { activity: { ...data, activity_type: data.activity_type as ActivityType, status: data.status as ActivityStatus } };
}

export async function updateActivity(
  id: string,
  patch: Partial<{
    plotId: string | null;
    plantingId: string | null;
    activityType: ActivityType;
    title: string;
    dueOn: string | null;
    assignee: string | null;
    status: ActivityStatus;
    notes: string | null;
  }>,
): Promise<{ activity: FarmActivity } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.plotId !== undefined) update.plot_id = patch.plotId;
  if (patch.plantingId !== undefined) update.planting_id = patch.plantingId;
  if (patch.activityType != null) update.activity_type = patch.activityType;
  if (patch.title != null) update.title = patch.title.trim();
  if (patch.dueOn !== undefined) update.due_on = patch.dueOn;
  if (patch.assignee !== undefined) update.assignee = patch.assignee;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.status != null) {
    update.status = patch.status;
    update.completed_at = patch.status === "done" ? new Date().toISOString() : null;
  }

  const { data, error } = await supabase
    .from("farm_activities")
    .update(update)
    .eq("id", id)
    .select(
      "id, plot_id, planting_id, activity_type, title, due_on, assignee, status, completed_at, alert_sent_at, notes, created_at",
    )
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to update activity" };
  return { activity: { ...data, activity_type: data.activity_type as ActivityType, status: data.status as ActivityStatus } };
}

export async function deleteActivity(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("farm_activities").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Inputs (stock) + movements
// ---------------------------------------------------------------------------

export async function listInputs(): Promise<FarmInput[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("farm_inputs")
    .select("id, name, unit, quantity_on_hand, reorder_threshold, last_restocked_on, notes, created_at")
    .order("name", { ascending: true });
  if (error || !data) return [];
  return data.map((r) => ({
    ...r,
    quantity_on_hand: num(r.quantity_on_hand),
    reorder_threshold: num(r.reorder_threshold),
  }));
}

export async function createInput(input: {
  name: string;
  unit?: string;
  quantityOnHand?: number;
  reorderThreshold?: number;
  notes?: string | null;
}): Promise<{ input: FarmInput } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("farm_inputs")
    .insert({
      name: input.name.trim(),
      unit: input.unit ?? "unit",
      quantity_on_hand: input.quantityOnHand ?? 0,
      reorder_threshold: input.reorderThreshold ?? 0,
      notes: input.notes ?? null,
    })
    .select("id, name, unit, quantity_on_hand, reorder_threshold, last_restocked_on, notes, created_at")
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create input" };
  return {
    input: { ...data, quantity_on_hand: num(data.quantity_on_hand), reorder_threshold: num(data.reorder_threshold) },
  };
}

export async function updateInput(
  id: string,
  patch: Partial<{
    name: string;
    unit: string;
    reorderThreshold: number;
    notes: string | null;
  }>,
): Promise<{ input: FarmInput } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name != null) update.name = patch.name.trim();
  if (patch.unit != null) update.unit = patch.unit.trim();
  if (patch.reorderThreshold != null) update.reorder_threshold = patch.reorderThreshold;
  if (patch.notes !== undefined) update.notes = patch.notes;

  const { data, error } = await supabase
    .from("farm_inputs")
    .update(update)
    .eq("id", id)
    .select("id, name, unit, quantity_on_hand, reorder_threshold, last_restocked_on, notes, created_at")
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to update input" };
  return {
    input: { ...data, quantity_on_hand: num(data.quantity_on_hand), reorder_threshold: num(data.reorder_threshold) },
  };
}

export async function deleteInput(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("farm_inputs").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

/** Adjust stock and log the movement in one call — mirrors expense-linked maintenance records. */
export async function recordInputMovement(input: {
  inputId: string;
  delta: number;
  reason: "restock" | "used" | "adjustment" | "waste";
  expenseId?: string | null;
  activityId?: string | null;
  createdBy?: string | null;
}): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from("farm_inputs")
    .select("quantity_on_hand")
    .eq("id", input.inputId)
    .single();
  if (readError || !current) return { error: readError?.message ?? "Input not found" };

  const nextQty = num(current.quantity_on_hand) + input.delta;
  const patch: Record<string, unknown> = {
    quantity_on_hand: nextQty,
    updated_at: new Date().toISOString(),
  };
  if (input.reason === "restock") patch.last_restocked_on = new Date().toISOString().slice(0, 10);

  const { error: updateError } = await supabase.from("farm_inputs").update(patch).eq("id", input.inputId);
  if (updateError) return { error: updateError.message };

  const { error: moveError } = await supabase.from("farm_input_movements").insert({
    input_id: input.inputId,
    delta: input.delta,
    reason: input.reason,
    expense_id: input.expenseId ?? null,
    activity_id: input.activityId ?? null,
    created_by: input.createdBy ?? null,
  });
  if (moveError) return { error: moveError.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export async function listFarmExpenses(input?: {
  from?: string;
  to?: string;
  plotId?: string;
  category?: FarmExpenseCategory;
}): Promise<FarmExpense[]> {
  const supabase = await createClient();
  let q = supabase
    .from("farm_expenses")
    .select("id, category, amount, currency, spent_on, plot_id, planting_id, input_id, notes, created_by, created_at")
    .order("spent_on", { ascending: false });
  if (input?.from) q = q.gte("spent_on", input.from);
  if (input?.to) q = q.lte("spent_on", input.to);
  if (input?.plotId) q = q.eq("plot_id", input.plotId);
  if (input?.category) q = q.eq("category", input.category);
  const { data, error } = await q;
  if (error) {
    console.error("listFarmExpenses", error.message);
    return [];
  }
  if (!data) return [];
  return data.map((r) => ({ ...r, amount: num(r.amount), category: r.category as FarmExpenseCategory }));
}

export async function createFarmExpense(input: {
  category: FarmExpenseCategory;
  amount: number;
  currency?: string;
  spentOn?: string;
  plotId?: string | null;
  plantingId?: string | null;
  inputId?: string | null;
  notes?: string | null;
  createdBy?: string | null;
}): Promise<{ expense: FarmExpense } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("farm_expenses")
    .insert({
      category: input.category,
      amount: input.amount,
      currency: input.currency ?? "TZS",
      spent_on: input.spentOn ?? new Date().toISOString().slice(0, 10),
      plot_id: input.plotId ?? null,
      planting_id: input.plantingId ?? null,
      input_id: input.inputId ?? null,
      notes: input.notes ?? null,
      created_by: input.createdBy ?? null,
    })
    .select("id, category, amount, currency, spent_on, plot_id, planting_id, input_id, notes, created_by, created_at")
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create expense" };
  return { expense: { ...data, amount: num(data.amount), category: data.category as FarmExpenseCategory } };
}

export async function updateFarmExpense(
  id: string,
  patch: Partial<{
    category: FarmExpenseCategory;
    amount: number;
    currency: string;
    spentOn: string;
    plotId: string | null;
    plantingId: string | null;
    inputId: string | null;
    notes: string | null;
  }>,
): Promise<{ expense: FarmExpense } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.category != null) update.category = patch.category;
  if (patch.amount != null) update.amount = patch.amount;
  if (patch.currency != null) update.currency = patch.currency;
  if (patch.spentOn != null) update.spent_on = patch.spentOn;
  if (patch.plotId !== undefined) update.plot_id = patch.plotId;
  if (patch.plantingId !== undefined) update.planting_id = patch.plantingId;
  if (patch.inputId !== undefined) update.input_id = patch.inputId;
  if (patch.notes !== undefined) update.notes = patch.notes;

  const { data, error } = await supabase
    .from("farm_expenses")
    .update(update)
    .eq("id", id)
    .select("id, category, amount, currency, spent_on, plot_id, planting_id, input_id, notes, created_by, created_at")
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to update expense" };
  return { expense: { ...data, amount: num(data.amount), category: data.category as FarmExpenseCategory } };
}

export async function deleteFarmExpense(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("farm_expenses").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

export async function listFarmBudgets(period?: string): Promise<FarmBudget[]> {
  const supabase = await createClient();
  let q = supabase
    .from("farm_budgets")
    .select("id, category, period, planned_amount, currency, notes, created_at")
    .order("period", { ascending: false });
  if (period) q = q.eq("period", period);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map((r) => ({ ...r, planned_amount: num(r.planned_amount), category: r.category as FarmBudgetCategory }));
}

export async function upsertFarmBudget(input: {
  category: FarmBudgetCategory;
  period: string;
  plannedAmount: number;
  currency?: string;
  notes?: string | null;
}): Promise<{ budget: FarmBudget } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("farm_budgets")
    .upsert(
      {
        category: input.category,
        period: input.period,
        planned_amount: input.plannedAmount,
        currency: input.currency ?? "TZS",
        notes: input.notes ?? null,
      },
      { onConflict: "category,period" },
    )
    .select("id, category, period, planned_amount, currency, notes, created_at")
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to save budget" };
  return { budget: { ...data, planned_amount: num(data.planned_amount), category: data.category as FarmBudgetCategory } };
}

export async function deleteFarmBudget(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("farm_budgets").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Harvests
// ---------------------------------------------------------------------------

export async function listHarvests(input?: { plotId?: string; from?: string; to?: string }): Promise<FarmHarvest[]> {
  const supabase = await createClient();
  let q = supabase
    .from("farm_harvests")
    .select(
      "id, planting_id, plot_id, harvested_on, quantity_kg, value_amount, currency, destination, photo_url, notes, created_by, created_at",
    )
    .order("harvested_on", { ascending: false });
  if (input?.plotId) q = q.eq("plot_id", input.plotId);
  if (input?.from) q = q.gte("harvested_on", input.from);
  if (input?.to) q = q.lte("harvested_on", input.to);
  const { data, error } = await q;
  if (error) {
    console.error("listHarvests", error.message);
    return [];
  }
  if (!data) return [];
  return data.map((r) => ({
    ...r,
    quantity_kg: num(r.quantity_kg),
    value_amount: r.value_amount != null ? num(r.value_amount) : null,
    destination: r.destination as HarvestDestination,
  }));
}

export async function createHarvest(input: {
  plotId: string;
  plantingId?: string | null;
  harvestedOn?: string;
  quantityKg: number;
  valueAmount?: number | null;
  currency?: string;
  destination?: HarvestDestination;
  photoUrl?: string | null;
  notes?: string | null;
  createdBy?: string | null;
}): Promise<{ harvest: FarmHarvest } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("farm_harvests")
    .insert({
      plot_id: input.plotId,
      planting_id: input.plantingId ?? null,
      harvested_on: input.harvestedOn ?? new Date().toISOString().slice(0, 10),
      quantity_kg: input.quantityKg,
      value_amount: input.valueAmount ?? null,
      currency: input.currency ?? "TZS",
      destination: input.destination ?? "kitchen",
      photo_url: input.photoUrl ?? null,
      notes: input.notes ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(
      "id, planting_id, plot_id, harvested_on, quantity_kg, value_amount, currency, destination, photo_url, notes, created_by, created_at",
    )
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to log harvest" };
  return {
    harvest: {
      ...data,
      quantity_kg: num(data.quantity_kg),
      value_amount: data.value_amount != null ? num(data.value_amount) : null,
      destination: data.destination as HarvestDestination,
    },
  };
}

export async function updateHarvest(
  id: string,
  patch: Partial<{
    plotId: string;
    plantingId: string | null;
    harvestedOn: string;
    quantityKg: number;
    valueAmount: number | null;
    currency: string;
    destination: HarvestDestination;
    photoUrl: string | null;
    notes: string | null;
  }>,
): Promise<{ harvest: FarmHarvest } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.plotId != null) update.plot_id = patch.plotId;
  if (patch.plantingId !== undefined) update.planting_id = patch.plantingId;
  if (patch.harvestedOn != null) update.harvested_on = patch.harvestedOn;
  if (patch.quantityKg != null) update.quantity_kg = patch.quantityKg;
  if (patch.valueAmount !== undefined) update.value_amount = patch.valueAmount;
  if (patch.currency != null) update.currency = patch.currency;
  if (patch.destination != null) update.destination = patch.destination;
  if (patch.photoUrl !== undefined) update.photo_url = patch.photoUrl;
  if (patch.notes !== undefined) update.notes = patch.notes;

  const { data, error } = await supabase
    .from("farm_harvests")
    .update(update)
    .eq("id", id)
    .select(
      "id, planting_id, plot_id, harvested_on, quantity_kg, value_amount, currency, destination, photo_url, notes, created_by, created_at",
    )
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to update harvest" };
  return {
    harvest: {
      ...data,
      quantity_kg: num(data.quantity_kg),
      value_amount: data.value_amount != null ? num(data.value_amount) : null,
      destination: data.destination as HarvestDestination,
    },
  };
}

export async function deleteHarvest(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("farm_harvests").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Weekly walkthroughs
// ---------------------------------------------------------------------------

export async function listWalkthroughs(input?: { plotId?: string; limit?: number }): Promise<FarmWalkthrough[]> {
  const supabase = await createClient();
  let q = supabase
    .from("farm_walkthroughs")
    .select("id, week_of, plot_id, checklist, overall_score, photo_url, notes, reviewed_by, created_at")
    .order("week_of", { ascending: false });
  if (input?.plotId) q = q.eq("plot_id", input.plotId);
  if (input?.limit) q = q.limit(input.limit);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map((r) => ({
    ...r,
    checklist: (r.checklist as Record<string, unknown>) ?? {},
    overall_score: r.overall_score != null ? num(r.overall_score) : null,
  }));
}

export async function createWalkthrough(input: {
  weekOf: string;
  plotId?: string | null;
  checklist: Record<string, unknown>;
  overallScore?: number | null;
  photoUrl?: string | null;
  notes?: string | null;
  reviewedBy?: string | null;
}): Promise<{ walkthrough: FarmWalkthrough } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("farm_walkthroughs")
    .insert({
      week_of: input.weekOf,
      plot_id: input.plotId ?? null,
      checklist: input.checklist,
      overall_score: input.overallScore ?? null,
      photo_url: input.photoUrl ?? null,
      notes: input.notes ?? null,
      reviewed_by: input.reviewedBy ?? null,
    })
    .select("id, week_of, plot_id, checklist, overall_score, photo_url, notes, reviewed_by, created_at")
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to log walkthrough" };
  return {
    walkthrough: {
      ...data,
      checklist: (data.checklist as Record<string, unknown>) ?? {},
      overall_score: data.overall_score != null ? num(data.overall_score) : null,
    },
  };
}

export async function updateWalkthrough(
  id: string,
  patch: Partial<{
    weekOf: string;
    plotId: string | null;
    checklist: Record<string, unknown>;
    overallScore: number | null;
    photoUrl: string | null;
    notes: string | null;
  }>,
): Promise<{ walkthrough: FarmWalkthrough } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.weekOf != null) update.week_of = patch.weekOf;
  if (patch.plotId !== undefined) update.plot_id = patch.plotId;
  if (patch.checklist != null) update.checklist = patch.checklist;
  if (patch.overallScore !== undefined) update.overall_score = patch.overallScore;
  if (patch.photoUrl !== undefined) update.photo_url = patch.photoUrl;
  if (patch.notes !== undefined) update.notes = patch.notes;

  const { data, error } = await supabase
    .from("farm_walkthroughs")
    .update(update)
    .eq("id", id)
    .select("id, week_of, plot_id, checklist, overall_score, photo_url, notes, reviewed_by, created_at")
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to update walkthrough" };
  return {
    walkthrough: {
      ...data,
      checklist: (data.checklist as Record<string, unknown>) ?? {},
      overall_score: data.overall_score != null ? num(data.overall_score) : null,
    },
  };
}

export async function deleteWalkthrough(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("farm_walkthroughs").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// P&L summary (Farm P&L / Net Savings tabs)
// ---------------------------------------------------------------------------

export async function getFarmPnL(input: { from: string; to: string }) {
  const [expenses, harvests, budgets] = await Promise.all([
    listFarmExpenses({ from: input.from, to: input.to }),
    listHarvests({ from: input.from, to: input.to }),
    listFarmBudgets(),
  ]);

  const total_expense = expenses.reduce((s, e) => s + e.amount, 0);
  const total_harvest_value = harvests.reduce((s, h) => s + (h.value_amount ?? 0), 0);
  const kitchen_value = harvests
    .filter((h) => h.destination === "kitchen")
    .reduce((s, h) => s + (h.value_amount ?? 0), 0);

  const expense_by_category: Record<string, number> = {};
  for (const e of expenses) {
    expense_by_category[e.category] = (expense_by_category[e.category] ?? 0) + e.amount;
  }

  const budget_burn = budgets.map((b) => {
    const spent = expenses
      .filter((e) => b.category === "all" || e.category === b.category)
      .reduce((s, e) => s + e.amount, 0);
    return {
      category: b.category,
      period: b.period,
      planned_amount: b.planned_amount,
      spent,
      remaining: b.planned_amount - spent,
      burn_pct: b.planned_amount > 0 ? Math.round((spent / b.planned_amount) * 1000) / 10 : 0,
    };
  });

  return {
    from: input.from,
    to: input.to,
    currency: "TZS",
    total_expense,
    total_harvest_value,
    kitchen_value,
    net_savings: total_harvest_value - total_expense,
    expense_by_category,
    budget_burn,
    harvest_count: harvests.length,
    total_yield_kg: harvests.reduce((s, h) => s + h.quantity_kg, 0),
  };
}

// ---------------------------------------------------------------------------
// Alerts — overdue activity / budget overrun / low stock.
// Call from a cron route (e.g. /api/cron/farm-alerts); dedupe is enforced by
// the partial unique indexes on farm_alerts (see schema_farm.sql).
// ---------------------------------------------------------------------------

export async function checkFarmAlerts(): Promise<{ raised: FarmAlert[] }> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const raised: FarmAlert[] = [];

  const { data: overdue } = await supabase
    .from("farm_activities")
    .select("id, title, due_on")
    .lt("due_on", today)
    .in("status", ["pending", "in_progress"]);

  for (const activity of overdue ?? []) {
    const { data, error } = await supabase
      .from("farm_alerts")
      .insert({
        kind: "activity_overdue",
        activity_id: activity.id,
        message: `Farm activity overdue: "${activity.title}" (due ${activity.due_on})`,
      })
      .select("id, kind, activity_id, budget_id, input_id, message, status, created_at")
      .single();
    if (!error && data) {
      raised.push(data as FarmAlert);
      await supabase.from("farm_activities").update({ alert_sent_at: new Date().toISOString() }).eq("id", activity.id);
    }
  }

  const { data: lowStock } = await supabase
    .from("farm_inputs")
    .select("id, name, quantity_on_hand, reorder_threshold, unit")
    .order("name");
  for (const input of lowStock ?? []) {
    if (num(input.quantity_on_hand) > num(input.reorder_threshold)) continue;
    const { data, error } = await supabase
      .from("farm_alerts")
      .insert({
        kind: "low_stock",
        input_id: input.id,
        message: `Low stock: ${input.name} at ${num(input.quantity_on_hand)} ${input.unit} (reorder at ${num(input.reorder_threshold)})`,
      })
      .select("id, kind, activity_id, budget_id, input_id, message, status, created_at")
      .single();
    if (!error && data) raised.push(data as FarmAlert);
  }

  const currentPeriod = today.slice(0, 7); // YYYY-MM
  const budgets = await listFarmBudgets(currentPeriod);
  const expenses = await listFarmExpenses({ from: `${currentPeriod}-01`, to: today });
  for (const budget of budgets) {
    const spent = expenses
      .filter((e) => budget.category === "all" || e.category === budget.category)
      .reduce((s, e) => s + e.amount, 0);
    if (spent <= budget.planned_amount) continue;
    const { data, error } = await supabase
      .from("farm_alerts")
      .insert({
        kind: "budget_overrun",
        budget_id: budget.id,
        message: `Farm budget overrun: ${budget.category} ${budget.period} spent ${spent} of ${budget.planned_amount}`,
      })
      .select("id, kind, activity_id, budget_id, input_id, message, status, created_at")
      .single();
    if (!error && data) raised.push(data as FarmAlert);
  }

  if (raised.length > 0) {
    const summary = raised.map((a) => `- ${a.message}`).join("\n");
    const result = await notifyAdminSms({
      message: `Farm alerts (${raised.length}):\n${summary}`.slice(0, 480),
    });
    if (result.sent || result.provider === "stub") {
      const ids = raised.map((a) => a.id);
      await supabase.from("farm_alerts").update({ status: "notified" }).in("id", ids);
    }
  }

  return { raised };
}
