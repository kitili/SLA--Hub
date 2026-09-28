import { createClient } from "@/lib/supabase/server";

export type KitchenIngredientCategory = "grain" | "vegetable" | "meat" | "other";
export type KitchenCalcMethod = "headcount_ratio" | "flat_weekly";

export type KitchenIngredient = {
  id: string;
  name: string;
  unit: string;
  category: KitchenIngredientCategory;
  calc_method: KitchenCalcMethod;
  people_per_kg: number | null;
  kg_per_week: number | null;
  default_unit_price: number;
  active: boolean;
};

/** Per-campus override of an ingredient's calc constants — the sheet's own
 * "people per kg" / "weeks in a month" figures genuinely differ by campus;
 * null fields here mean "use the ingredient's global default." */
export type KitchenIngredientCampusSetting = {
  id: string;
  school_id: string;
  ingredient_id: string;
  people_per_kg: number | null;
  kg_per_week: number | null;
  weeks_in_month: number | null;
};

export type KitchenHeadcountLine = {
  id: string;
  school_id: string;
  month: string;
  category: string;
  label: string | null;
  headcount: number;
  days_in_period: number;
  price_per_person: number;
};

export type KitchenBudget = {
  id: string;
  school_id: string;
  month: string;
  budget_amount: number;
  currency: string;
};

export type KitchenPurchase = {
  id: string;
  school_id: string;
  month: string;
  ingredient_id: string;
  quantity: number;
  unit_price: number;
  total_cost: number;
  purchased_on: string | null;
  notes: string | null;
  created_at: string;
  ingredient_name?: string;
  vendor_id: string | null;
  vendor_name?: string;
};

const INGREDIENT_COLUMNS =
  "id, name, unit, category, calc_method, people_per_kg, kg_per_week, default_unit_price, active";

export async function listKitchenIngredients(): Promise<KitchenIngredient[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_ingredients")
    .select(INGREDIENT_COLUMNS)
    .order("category")
    .order("name");
  if (error || !data) return [];
  return data as unknown as KitchenIngredient[];
}

export async function createKitchenIngredient(input: {
  name: string;
  unit: string;
  category: KitchenIngredientCategory;
  calcMethod: KitchenCalcMethod;
  peoplePerKg?: number | null;
  kgPerWeek?: number | null;
  defaultUnitPrice: number;
}): Promise<{ ingredient: KitchenIngredient } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_ingredients")
    .insert({
      name: input.name,
      unit: input.unit,
      category: input.category,
      calc_method: input.calcMethod,
      people_per_kg: input.peoplePerKg ?? null,
      kg_per_week: input.kgPerWeek ?? null,
      default_unit_price: input.defaultUnitPrice,
    })
    .select(INGREDIENT_COLUMNS)
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to add ingredient" };
  }
  return { ingredient: data as unknown as KitchenIngredient };
}

export async function updateKitchenIngredient(
  id: string,
  patch: Partial<{
    name: string;
    unit: string;
    category: KitchenIngredientCategory;
    calcMethod: KitchenCalcMethod;
    peoplePerKg: number | null;
    kgPerWeek: number | null;
    defaultUnitPrice: number;
    active: boolean;
  }>,
): Promise<{ ingredient: KitchenIngredient } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.unit !== undefined) update.unit = patch.unit;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.calcMethod !== undefined) update.calc_method = patch.calcMethod;
  if (patch.peoplePerKg !== undefined) update.people_per_kg = patch.peoplePerKg;
  if (patch.kgPerWeek !== undefined) update.kg_per_week = patch.kgPerWeek;
  if (patch.defaultUnitPrice !== undefined) update.default_unit_price = patch.defaultUnitPrice;
  if (patch.active !== undefined) update.active = patch.active;

  const { data, error } = await supabase
    .from("kitchen_ingredients")
    .update(update)
    .eq("id", id)
    .select(INGREDIENT_COLUMNS)
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to update ingredient" };
  }
  return { ingredient: data as unknown as KitchenIngredient };
}

export async function listKitchenIngredientCampusSettings(
  schoolId: string,
): Promise<KitchenIngredientCampusSetting[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_ingredient_campus_settings")
    .select("id, school_id, ingredient_id, people_per_kg, kg_per_week, weeks_in_month")
    .eq("school_id", schoolId);
  if (error || !data) return [];
  return data as KitchenIngredientCampusSetting[];
}

export async function upsertKitchenIngredientCampusSetting(input: {
  schoolId: string;
  ingredientId: string;
  peoplePerKg: number | null;
  kgPerWeek: number | null;
  weeksInMonth: number | null;
}): Promise<{ setting: KitchenIngredientCampusSetting } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_ingredient_campus_settings")
    .upsert(
      {
        school_id: input.schoolId,
        ingredient_id: input.ingredientId,
        people_per_kg: input.peoplePerKg,
        kg_per_week: input.kgPerWeek,
        weeks_in_month: input.weeksInMonth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "school_id,ingredient_id" },
    )
    .select("id, school_id, ingredient_id, people_per_kg, kg_per_week, weeks_in_month")
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to save campus setting" };
  }
  return { setting: data as KitchenIngredientCampusSetting };
}

/** Latest effective price per ingredient for a campus, as of a given date —
 * checks the campus-specific price series first, then the global (school_id
 * null) series, else the caller should fall back to ingredient.default_unit_price. */
export async function getEffectiveKitchenIngredientPrices(
  schoolId: string,
  asOfDate: string,
): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_ingredient_prices")
    .select("ingredient_id, school_id, effective_date, unit_price")
    .or(`school_id.eq.${schoolId},school_id.is.null`)
    .lte("effective_date", asOfDate)
    .order("effective_date", { ascending: false });
  if (error || !data) return new Map();

  const prices = new Map<string, number>();
  const campusPriority = new Map<string, boolean>();
  for (const row of data as { ingredient_id: string; school_id: string | null; unit_price: number }[]) {
    const isCampusSpecific = row.school_id === schoolId;
    if (prices.has(row.ingredient_id) && !(isCampusSpecific && !campusPriority.get(row.ingredient_id))) {
      continue;
    }
    prices.set(row.ingredient_id, row.unit_price);
    campusPriority.set(row.ingredient_id, isCampusSpecific);
  }
  return prices;
}

export async function recordKitchenIngredientPrice(input: {
  ingredientId: string;
  schoolId: string | null;
  effectiveDate: string;
  unitPrice: number;
}): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("kitchen_ingredient_prices").upsert(
    {
      ingredient_id: input.ingredientId,
      school_id: input.schoolId,
      effective_date: input.effectiveDate,
      unit_price: input.unitPrice,
    },
    { onConflict: "ingredient_id,school_id,effective_date" },
  );
  if (error) return { error: error.message };
  return { ok: true };
}

export async function listKitchenHeadcountLines(
  schoolId: string,
  month: string,
): Promise<KitchenHeadcountLine[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_headcount_lines")
    .select("id, school_id, month, category, label, headcount, days_in_period, price_per_person")
    .eq("school_id", schoolId)
    .eq("month", month)
    .order("created_at");
  if (error || !data) return [];
  return data as KitchenHeadcountLine[];
}

export type KitchenHeadcountLineExportRow = KitchenHeadcountLine & { school_name?: string };

/** Every headcount line across every campus/month, for CSV export -- not
 * scoped to one campus/month like listKitchenHeadcountLines. */
export async function listAllKitchenHeadcountLinesForExport(): Promise<
  KitchenHeadcountLineExportRow[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_headcount_lines")
    .select(
      "id, school_id, month, category, label, headcount, days_in_period, price_per_person, schools(name)",
    )
    .order("month", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => {
    const { schools, ...rest } = row as typeof row & {
      schools?: { name: string } | { name: string }[] | null;
    };
    const school = Array.isArray(schools) ? schools[0] : schools;
    return { ...rest, school_name: school?.name } as KitchenHeadcountLineExportRow;
  });
}

/** Replaces the full set of headcount lines for a school/month in one shot —
 * matches how the UI edits "all lines for this period" as a unit, and avoids
 * needing per-line create/update/delete round-trips for a small, bounded list. */
export async function replaceKitchenHeadcountLines(
  schoolId: string,
  month: string,
  lines: Array<{
    category: string;
    label: string | null;
    headcount: number;
    daysInPeriod: number;
    pricePerPerson: number;
  }>,
): Promise<{ lines: KitchenHeadcountLine[] } | { error: string }> {
  const supabase = await createClient();
  const { error: deleteError } = await supabase
    .from("kitchen_headcount_lines")
    .delete()
    .eq("school_id", schoolId)
    .eq("month", month);
  if (deleteError) return { error: deleteError.message };

  if (lines.length === 0) return { lines: [] };

  const { data, error } = await supabase
    .from("kitchen_headcount_lines")
    .insert(
      lines.map((l) => ({
        school_id: schoolId,
        month,
        category: l.category,
        label: l.label,
        headcount: l.headcount,
        days_in_period: l.daysInPeriod,
        price_per_person: l.pricePerPerson,
      })),
    )
    .select("id, school_id, month, category, label, headcount, days_in_period, price_per_person");
  if (error || !data) {
    return { error: error?.message ?? "Failed to save headcount lines" };
  }
  return { lines: data as KitchenHeadcountLine[] };
}

export async function getKitchenBudget(
  schoolId: string,
  month: string,
): Promise<KitchenBudget | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_budgets")
    .select("id, school_id, month, budget_amount, currency")
    .eq("school_id", schoolId)
    .eq("month", month)
    .maybeSingle();
  if (error || !data) return null;
  return data as KitchenBudget;
}

export async function upsertKitchenBudget(input: {
  schoolId: string;
  month: string;
  budgetAmount: number;
  currency?: string;
}): Promise<{ budget: KitchenBudget } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_budgets")
    .upsert(
      {
        school_id: input.schoolId,
        month: input.month,
        budget_amount: input.budgetAmount,
        currency: input.currency ?? "TZS",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "school_id,month" },
    )
    .select("id, school_id, month, budget_amount, currency")
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to save budget" };
  }
  return { budget: data as KitchenBudget };
}

export type KitchenBudgetExportRow = KitchenBudget & { school_name?: string };

/** Every budget row across every campus/month, for CSV export -- not scoped
 * to one school/month like getKitchenBudget. */
export async function listAllKitchenBudgetsForExport(): Promise<KitchenBudgetExportRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_budgets")
    .select("id, school_id, month, budget_amount, currency, schools(name)")
    .order("month", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => {
    const { schools, ...rest } = row as typeof row & {
      schools?: { name: string } | { name: string }[] | null;
    };
    const school = Array.isArray(schools) ? schools[0] : schools;
    return { ...rest, school_name: school?.name } as KitchenBudgetExportRow;
  });
}

export async function listKitchenPurchases(
  schoolId: string,
  month: string,
): Promise<KitchenPurchase[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_purchases")
    .select(
      "id, school_id, month, ingredient_id, quantity, unit_price, total_cost, purchased_on, notes, created_at, vendor_id, kitchen_ingredients(name), kitchen_vendors(name)",
    )
    .eq("school_id", schoolId)
    .eq("month", month)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  return data.map((row) => {
    const { kitchen_ingredients, kitchen_vendors, ...rest } = row as typeof row & {
      kitchen_ingredients?: { name: string } | { name: string }[] | null;
      kitchen_vendors?: { name: string } | { name: string }[] | null;
    };
    const ingredient = Array.isArray(kitchen_ingredients)
      ? kitchen_ingredients[0]
      : kitchen_ingredients;
    const vendor = Array.isArray(kitchen_vendors) ? kitchen_vendors[0] : kitchen_vendors;
    return {
      ...rest,
      ingredient_name: ingredient?.name,
      vendor_name: vendor?.name,
    } as KitchenPurchase;
  });
}

export type KitchenRecentPurchase = KitchenPurchase & { school_name?: string };

/** Most recent purchases across every campus, for a Top Sheet activity feed
 * -- not scoped to one campus/month like listKitchenPurchases. */
export async function listRecentKitchenPurchases(limit = 10): Promise<KitchenRecentPurchase[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_purchases")
    .select(
      "id, school_id, month, ingredient_id, quantity, unit_price, total_cost, purchased_on, notes, created_at, kitchen_ingredients(name), schools(name)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  return data.map((row) => {
    const { kitchen_ingredients, schools, ...rest } = row as typeof row & {
      kitchen_ingredients?: { name: string } | { name: string }[] | null;
      schools?: { name: string } | { name: string }[] | null;
    };
    const ingredient = Array.isArray(kitchen_ingredients) ? kitchen_ingredients[0] : kitchen_ingredients;
    const school = Array.isArray(schools) ? schools[0] : schools;
    return {
      ...rest,
      ingredient_name: ingredient?.name,
      school_name: school?.name,
    } as KitchenRecentPurchase;
  });
}

/** Live row counts across every kitchen_* table, for a Facilities/Farm-style
 * "quick stats" module grid proving each sub-area has real data behind it. */
export async function getKitchenModuleCounts(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const tables = [
    "kitchen_ingredients",
    "kitchen_headcount_lines",
    "kitchen_purchases",
    "kitchen_ingredient_campus_settings",
    "kitchen_ingredient_prices",
    "kitchen_checklist_templates",
    "kitchen_sop_tasks",
    "kitchen_survey_responses",
  ] as const;

  const results = await Promise.all(
    tables.map((t) => supabase.from(t).select("*", { count: "exact", head: true })),
  );

  const counts: Record<string, number> = {};
  tables.forEach((t, i) => {
    counts[t] = results[i].count ?? 0;
  });
  return counts;
}

export async function createKitchenPurchase(input: {
  schoolId: string;
  month: string;
  ingredientId: string;
  quantity: number;
  unitPrice: number;
  purchasedOn?: string | null;
  notes?: string | null;
  vendorId?: string | null;
  createdBy?: string | null;
}): Promise<{ purchase: KitchenPurchase } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_purchases")
    .insert({
      school_id: input.schoolId,
      month: input.month,
      ingredient_id: input.ingredientId,
      quantity: input.quantity,
      unit_price: input.unitPrice,
      total_cost: input.quantity * input.unitPrice,
      purchased_on: input.purchasedOn ?? null,
      notes: input.notes ?? null,
      vendor_id: input.vendorId ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(
      "id, school_id, month, ingredient_id, quantity, unit_price, total_cost, purchased_on, notes, created_at, vendor_id, kitchen_ingredients(name)",
    )
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to record purchase" };
  }
  const { kitchen_ingredients, ...rest } = data as typeof data & {
    kitchen_ingredients?: { name: string } | { name: string }[] | null;
  };
  const ingredient = Array.isArray(kitchen_ingredients) ? kitchen_ingredients[0] : kitchen_ingredients;
  return { purchase: { ...rest, ingredient_name: ingredient?.name } as KitchenPurchase };
}

export async function deleteKitchenPurchase(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_purchases")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Purchase not found or not permitted" };
  return { ok: true };
}

export async function updateKitchenPurchase(
  id: string,
  patch: Partial<{
    quantity: number;
    unitPrice: number;
    purchasedOn: string | null;
    notes: string | null;
  }>,
): Promise<{ purchase: KitchenPurchase } | { error: string }> {
  const supabase = await createClient();

  const update: Record<string, unknown> = {};
  if (patch.purchasedOn !== undefined) update.purchased_on = patch.purchasedOn;
  if (patch.notes !== undefined) update.notes = patch.notes;

  if (patch.quantity !== undefined || patch.unitPrice !== undefined) {
    // total_cost is derived, so when either factor changes we need both
    // current values to recompute it correctly.
    const { data: current, error: fetchError } = await supabase
      .from("kitchen_purchases")
      .select("quantity, unit_price")
      .eq("id", id)
      .single();
    if (fetchError || !current) {
      return { error: fetchError?.message ?? "Purchase not found" };
    }
    const quantity = patch.quantity ?? current.quantity;
    const unitPrice = patch.unitPrice ?? current.unit_price;
    update.quantity = quantity;
    update.unit_price = unitPrice;
    update.total_cost = quantity * unitPrice;
  }

  const { data, error } = await supabase
    .from("kitchen_purchases")
    .update(update)
    .eq("id", id)
    .select(
      "id, school_id, month, ingredient_id, quantity, unit_price, total_cost, purchased_on, notes, created_at",
    )
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to update purchase" };
  }
  return { purchase: data as KitchenPurchase };
}

// ── Supplies / consumables (module 4.6-adjacent -- cleaning items etc.,
// deliberately separate from food kitchen_ingredients) ──────────────────────

export type KitchenSupply = {
  id: string;
  name: string;
  unit: string;
  default_unit_price: number;
  active: boolean;
};

export type KitchenSupplyPurchase = {
  id: string;
  school_id: string;
  month: string;
  supply_id: string;
  quantity: number;
  unit_price: number;
  total_cost: number;
  purchased_on: string | null;
  notes: string | null;
  created_at: string;
  supply_name?: string;
};

export async function listKitchenSupplies(): Promise<KitchenSupply[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_supplies")
    .select("id, name, unit, default_unit_price, active")
    .eq("active", true)
    .order("name");
  if (error || !data) return [];
  return data as KitchenSupply[];
}

/** Active AND inactive, for CSV export/import matching -- listKitchenSupplies()
 * is active-only (correct for the catalog-panel UI), which would make a
 * re-imported inactive supply look unmatched and get created as a duplicate. */
export async function listAllKitchenSuppliesForExport(): Promise<KitchenSupply[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_supplies")
    .select("id, name, unit, default_unit_price, active")
    .order("name");
  if (error || !data) return [];
  return data as KitchenSupply[];
}

export async function listKitchenSupplyPurchases(
  schoolId: string,
  month: string,
): Promise<KitchenSupplyPurchase[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_supply_purchases")
    .select(
      "id, school_id, month, supply_id, quantity, unit_price, total_cost, purchased_on, notes, created_at, kitchen_supplies(name)",
    )
    .eq("school_id", schoolId)
    .eq("month", month)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  return data.map((row) => {
    const { kitchen_supplies, ...rest } = row as typeof row & {
      kitchen_supplies?: { name: string } | { name: string }[] | null;
    };
    const supply = Array.isArray(kitchen_supplies) ? kitchen_supplies[0] : kitchen_supplies;
    return { ...rest, supply_name: supply?.name } as KitchenSupplyPurchase;
  });
}

export type KitchenSupplyPurchaseExportRow = KitchenSupplyPurchase & { school_name?: string };

/** Every supply purchase across every campus, for CSV export -- not scoped
 * to one campus/month like listKitchenSupplyPurchases. */
export async function listAllKitchenSupplyPurchasesForExport(): Promise<
  KitchenSupplyPurchaseExportRow[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_supply_purchases")
    .select(
      "id, school_id, month, supply_id, quantity, unit_price, total_cost, purchased_on, notes, created_at, kitchen_supplies(name), schools(name)",
    )
    .order("month", { ascending: false });
  if (error || !data) return [];

  return data.map((row) => {
    const { kitchen_supplies, schools, ...rest } = row as typeof row & {
      kitchen_supplies?: { name: string } | { name: string }[] | null;
      schools?: { name: string } | { name: string }[] | null;
    };
    const supply = Array.isArray(kitchen_supplies) ? kitchen_supplies[0] : kitchen_supplies;
    const school = Array.isArray(schools) ? schools[0] : schools;
    return {
      ...rest,
      supply_name: supply?.name,
      school_name: school?.name,
    } as KitchenSupplyPurchaseExportRow;
  });
}

export async function createKitchenSupplyPurchase(input: {
  schoolId: string;
  month: string;
  supplyId: string;
  quantity: number;
  unitPrice: number;
  purchasedOn?: string | null;
  notes?: string | null;
  createdBy?: string | null;
}): Promise<{ purchase: KitchenSupplyPurchase } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_supply_purchases")
    .insert({
      school_id: input.schoolId,
      month: input.month,
      supply_id: input.supplyId,
      quantity: input.quantity,
      unit_price: input.unitPrice,
      total_cost: input.quantity * input.unitPrice,
      purchased_on: input.purchasedOn ?? null,
      notes: input.notes ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(
      "id, school_id, month, supply_id, quantity, unit_price, total_cost, purchased_on, notes, created_at",
    )
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to record supply purchase" };
  }
  return { purchase: data as KitchenSupplyPurchase };
}

export async function deleteKitchenSupplyPurchase(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_supply_purchases")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Supply purchase not found or not permitted" };
  return { ok: true };
}

export async function updateKitchenSupplyPurchase(
  id: string,
  patch: Partial<{
    quantity: number;
    unitPrice: number;
    purchasedOn: string | null;
    notes: string | null;
  }>,
): Promise<{ purchase: KitchenSupplyPurchase } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.purchasedOn !== undefined) update.purchased_on = patch.purchasedOn;
  if (patch.notes !== undefined) update.notes = patch.notes;

  if (patch.quantity !== undefined || patch.unitPrice !== undefined) {
    // quantity/unit_price may be patched independently, so fetch whichever side
    // wasn't sent to recompute total_cost correctly.
    const { data: existing, error: fetchError } = await supabase
      .from("kitchen_supply_purchases")
      .select("quantity, unit_price")
      .eq("id", id)
      .single();
    if (fetchError || !existing) {
      return { error: fetchError?.message ?? "Supply purchase not found" };
    }
    const quantity = patch.quantity ?? existing.quantity;
    const unitPrice = patch.unitPrice ?? existing.unit_price;
    update.quantity = quantity;
    update.unit_price = unitPrice;
    update.total_cost = quantity * unitPrice;
  }

  const { data, error } = await supabase
    .from("kitchen_supply_purchases")
    .update(update)
    .eq("id", id)
    .select(
      "id, school_id, month, supply_id, quantity, unit_price, total_cost, purchased_on, notes, created_at",
    )
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to update supply purchase" };
  }
  return { purchase: data as KitchenSupplyPurchase };
}

// ── Compliance & checklists (module 4.1) ────────────────────────────────────

export type KitchenChecklistCadence = "daily" | "weekly" | "monthly";

export type KitchenChecklistTemplate = {
  id: string;
  cadence: KitchenChecklistCadence;
  item_text_en: string;
  item_text_sw: string | null;
  sort_order: number;
  active: boolean;
};

export type KitchenChecklistEntry = {
  id: string;
  template_id: string;
  school_id: string;
  period_date: string;
  score_value: number;
  comment: string | null;
  submitted_by: string | null;
  created_at: string;
};

export type KitchenSopTask = {
  id: string;
  role: "cook" | "head_of_kitchens" | "ops_manager";
  cadence: "daily" | "weekly" | "monthly" | "termly";
  description: string;
  sort_order: number;
};

export async function listKitchenChecklistTemplates(
  cadence?: KitchenChecklistCadence,
): Promise<KitchenChecklistTemplate[]> {
  const supabase = await createClient();
  let q = supabase
    .from("kitchen_checklist_templates")
    .select("id, cadence, item_text_en, item_text_sw, sort_order, active")
    .eq("active", true)
    .order("cadence")
    .order("sort_order");
  if (cadence) q = q.eq("cadence", cadence);
  const { data, error } = await q;
  if (error || !data) return [];
  return data as KitchenChecklistTemplate[];
}

export async function listKitchenChecklistEntries(
  schoolId: string,
  periodDates: string[],
): Promise<KitchenChecklistEntry[]> {
  if (periodDates.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_checklist_entries")
    .select("id, template_id, school_id, period_date, score_value, comment, submitted_by, created_at")
    .eq("school_id", schoolId)
    .in("period_date", periodDates);
  if (error || !data) return [];
  return data as KitchenChecklistEntry[];
}

export async function upsertKitchenChecklistEntry(input: {
  templateId: string;
  schoolId: string;
  periodDate: string;
  scoreValue: number;
  comment?: string | null;
  submittedBy?: string | null;
}): Promise<{ entry: KitchenChecklistEntry } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_checklist_entries")
    .upsert(
      {
        template_id: input.templateId,
        school_id: input.schoolId,
        period_date: input.periodDate,
        score_value: input.scoreValue,
        comment: input.comment ?? null,
        submitted_by: input.submittedBy ?? null,
      },
      { onConflict: "template_id,school_id,period_date" },
    )
    .select("id, template_id, school_id, period_date, score_value, comment, submitted_by, created_at")
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to save checklist entry" };
  }
  return { entry: data as KitchenChecklistEntry };
}

export async function listKitchenSopTasks(): Promise<KitchenSopTask[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_sop_tasks")
    .select("id, role, cadence, description, sort_order")
    .order("role")
    .order("cadence")
    .order("sort_order");
  if (error || !data) return [];
  return data as KitchenSopTask[];
}

/** Every campus's most recent entries for a cadence, across a date range —
 * used by the /ops/kitchen Compliance tab to compare campuses at a glance. */
export async function listKitchenChecklistEntriesForSchools(
  schoolIds: string[],
  periodDates: string[],
): Promise<KitchenChecklistEntry[]> {
  if (schoolIds.length === 0 || periodDates.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_checklist_entries")
    .select("id, template_id, school_id, period_date, score_value, comment, submitted_by, created_at")
    .in("school_id", schoolIds)
    .in("period_date", periodDates);
  if (error || !data) return [];
  return data as KitchenChecklistEntry[];
}

// ── Leadership KPI dashboard (module 4.2) ───────────────────────────────────

/** Every budget row Jan-1 through the given month for a calendar year,
 * across every campus — used to compute YTD budget savings %. */
export async function listKitchenBudgetsForYearToDate(
  year: number,
  throughMonth: string,
): Promise<KitchenBudget[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_budgets")
    .select("id, school_id, month, budget_amount, currency")
    .gte("month", `${year}-01-01`)
    .lte("month", throughMonth);
  if (error || !data) return [];
  return data as KitchenBudget[];
}

/** Every purchase Jan-1 through the given month for a calendar year, across
 * every campus — used to compute YTD actual spend. */
export async function listKitchenPurchasesForYearToDate(
  year: number,
  throughMonth: string,
): Promise<KitchenPurchase[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_purchases")
    .select("id, school_id, month, ingredient_id, quantity, unit_price, total_cost, purchased_on, notes, created_at")
    .gte("month", `${year}-01-01`)
    .lte("month", throughMonth);
  if (error || !data) return [];
  return data as KitchenPurchase[];
}

// ── Food quality & satisfaction (module 4.4) ────────────────────────────────

export type KitchenSurveySource = "food_quality_tracker" | "learner_survey";
export type KitchenQualityRating = "poor" | "fair" | "good" | "excellent";
export type KitchenConsistencyRating = "very_consistent" | "somewhat_consistent" | "not_consistent";
export type KitchenSatisfactionLevel = "most_satisfied" | "some_not_satisfied" | "many_not_satisfied";

export type KitchenSurveyResponse = {
  id: string;
  submitted_at: string;
  school_id: string | null;
  class_or_grade: string | null;
  source: KitchenSurveySource;
  quality_rating: KitchenQualityRating | null;
  served_on_time: boolean | null;
  sufficient_quantity: boolean | null;
  consistency_rating: KitchenConsistencyRating | null;
  satisfaction_level: KitchenSatisfactionLevel | null;
  comment_text: string | null;
};

const SURVEY_COLUMNS =
  "id, submitted_at, school_id, class_or_grade, source, quality_rating, served_on_time, sufficient_quantity, consistency_rating, satisfaction_level, comment_text";

export async function listKitchenSurveyResponses(filters?: {
  schoolId?: string;
  limit?: number;
}): Promise<KitchenSurveyResponse[]> {
  const supabase = await createClient();
  let q = supabase
    .from("kitchen_survey_responses")
    .select(SURVEY_COLUMNS)
    .order("submitted_at", { ascending: false })
    .limit(filters?.limit ?? 200);
  if (filters?.schoolId) q = q.eq("school_id", filters.schoolId);
  const { data, error } = await q;
  if (error || !data) return [];
  return data as KitchenSurveyResponse[];
}

// ── Staff roster (module 4.5, StaffMember half) ─────────────────────────────

export type KitchenStaffRole = "cook" | "head_of_kitchens" | "other";

export type KitchenStaffMember = {
  id: string;
  school_id: string;
  name: string;
  role: KitchenStaffRole;
  active: boolean;
};

export async function listKitchenStaffMembers(schoolId: string): Promise<KitchenStaffMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_staff_members")
    .select("id, school_id, name, role, active")
    .eq("school_id", schoolId)
    .order("active", { ascending: false })
    .order("name");
  if (error || !data) return [];
  return data as KitchenStaffMember[];
}

export type KitchenStaffMemberExportRow = KitchenStaffMember & { school_name?: string };

/** Every staff member across every campus (active and inactive), for CSV
 * export/import matching -- not scoped to one campus like listKitchenStaffMembers. */
export async function listAllKitchenStaffMembersForExport(): Promise<
  KitchenStaffMemberExportRow[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_staff_members")
    .select("id, school_id, name, role, active, schools(name)")
    .order("school_id")
    .order("name");
  if (error || !data) return [];
  return data.map((row) => {
    const { schools, ...rest } = row as typeof row & {
      schools?: { name: string } | { name: string }[] | null;
    };
    const school = Array.isArray(schools) ? schools[0] : schools;
    return { ...rest, school_name: school?.name } as KitchenStaffMemberExportRow;
  });
}

export async function createKitchenStaffMember(input: {
  schoolId: string;
  name: string;
  role: KitchenStaffRole;
}): Promise<{ member: KitchenStaffMember } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_staff_members")
    .insert({ school_id: input.schoolId, name: input.name, role: input.role })
    .select("id, school_id, name, role, active")
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to add staff member" };
  }
  return { member: data as KitchenStaffMember };
}

export async function updateKitchenStaffMember(
  id: string,
  patch: Partial<{ name: string; role: KitchenStaffRole; active: boolean }>,
): Promise<{ member: KitchenStaffMember } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_staff_members")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, school_id, name, role, active")
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to update staff member" };
  }
  return { member: data as KitchenStaffMember };
}

export async function createKitchenSurveyResponse(input: {
  schoolId?: string | null;
  classOrGrade?: string | null;
  source: KitchenSurveySource;
  qualityRating?: KitchenQualityRating | null;
  servedOnTime?: boolean | null;
  sufficientQuantity?: boolean | null;
  consistencyRating?: KitchenConsistencyRating | null;
  satisfactionLevel?: KitchenSatisfactionLevel | null;
  commentText?: string | null;
}): Promise<{ response: KitchenSurveyResponse } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_survey_responses")
    .insert({
      school_id: input.schoolId ?? null,
      class_or_grade: input.classOrGrade ?? null,
      source: input.source,
      quality_rating: input.qualityRating ?? null,
      served_on_time: input.servedOnTime ?? null,
      sufficient_quantity: input.sufficientQuantity ?? null,
      consistency_rating: input.consistencyRating ?? null,
      satisfaction_level: input.satisfactionLevel ?? null,
      comment_text: input.commentText ?? null,
    })
    .select(SURVEY_COLUMNS)
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to save survey response" };
  }
  return { response: data as KitchenSurveyResponse };
}

export async function updateKitchenSurveyResponse(
  id: string,
  patch: Partial<{
    schoolId: string | null;
    classOrGrade: string | null;
    source: KitchenSurveySource;
    qualityRating: KitchenQualityRating | null;
    servedOnTime: boolean | null;
    sufficientQuantity: boolean | null;
    consistencyRating: KitchenConsistencyRating | null;
    satisfactionLevel: KitchenSatisfactionLevel | null;
    commentText: string | null;
  }>,
): Promise<{ response: KitchenSurveyResponse } | { error: string }> {
  const supabase = await createClient();

  const update: Record<string, unknown> = {};
  if (patch.schoolId !== undefined) update.school_id = patch.schoolId;
  if (patch.classOrGrade !== undefined) update.class_or_grade = patch.classOrGrade;
  if (patch.source !== undefined) update.source = patch.source;
  if (patch.qualityRating !== undefined) update.quality_rating = patch.qualityRating;
  if (patch.servedOnTime !== undefined) update.served_on_time = patch.servedOnTime;
  if (patch.sufficientQuantity !== undefined) update.sufficient_quantity = patch.sufficientQuantity;
  if (patch.consistencyRating !== undefined) update.consistency_rating = patch.consistencyRating;
  if (patch.satisfactionLevel !== undefined) update.satisfaction_level = patch.satisfactionLevel;
  if (patch.commentText !== undefined) update.comment_text = patch.commentText;

  const { data, error } = await supabase
    .from("kitchen_survey_responses")
    .update(update)
    .eq("id", id)
    .select(SURVEY_COLUMNS)
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to update survey response" };
  }
  return { response: data as KitchenSurveyResponse };
}

export async function deleteKitchenSurveyResponse(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_survey_responses")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Survey response not found or not permitted" };
  return { ok: true };
}

// ── Equipment / utensils (per-campus, empty shell -- no real data to seed) ──

export type KitchenEquipmentCategory = "cookware" | "appliance" | "furniture" | "other";
export type KitchenEquipmentCondition = "good" | "fair" | "poor" | "needs_repair";

export type KitchenEquipment = {
  id: string;
  school_id: string;
  name: string;
  category: KitchenEquipmentCategory;
  quantity: number;
  condition: KitchenEquipmentCondition;
  purchased_on: string | null;
  replacement_cost: number | null;
  notes: string | null;
  active: boolean;
};

export type KitchenEquipmentMaintenanceLog = {
  id: string;
  equipment_id: string;
  logged_on: string;
  description: string;
  cost: number | null;
  created_at: string;
};

const EQUIPMENT_COLUMNS =
  "id, school_id, name, category, quantity, condition, purchased_on, replacement_cost, notes, active";

export async function listKitchenEquipment(schoolId: string): Promise<KitchenEquipment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_equipment")
    .select(EQUIPMENT_COLUMNS)
    .eq("school_id", schoolId)
    .eq("active", true)
    .order("category")
    .order("name");
  if (error || !data) return [];
  return data as unknown as KitchenEquipment[];
}

export type KitchenEquipmentExportRow = KitchenEquipment & { school_name?: string };

/** Every equipment item across every campus (active and inactive), for CSV
 * export/import matching -- not scoped to one campus like listKitchenEquipment. */
export async function listAllKitchenEquipmentForExport(): Promise<KitchenEquipmentExportRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_equipment")
    .select(`${EQUIPMENT_COLUMNS}, schools(name)`)
    .order("school_id")
    .order("category")
    .order("name");
  if (error || !data) return [];
  return data.map((row) => {
    const { schools, ...rest } = row as typeof row & {
      schools?: { name: string } | { name: string }[] | null;
    };
    const school = Array.isArray(schools) ? schools[0] : schools;
    return { ...rest, school_name: school?.name } as KitchenEquipmentExportRow;
  });
}

export async function createKitchenEquipment(input: {
  schoolId: string;
  name: string;
  category: KitchenEquipmentCategory;
  quantity: number;
  condition: KitchenEquipmentCondition;
  purchasedOn?: string | null;
  replacementCost?: number | null;
  notes?: string | null;
}): Promise<{ equipment: KitchenEquipment } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_equipment")
    .insert({
      school_id: input.schoolId,
      name: input.name,
      category: input.category,
      quantity: input.quantity,
      condition: input.condition,
      purchased_on: input.purchasedOn ?? null,
      replacement_cost: input.replacementCost ?? null,
      notes: input.notes ?? null,
    })
    .select(EQUIPMENT_COLUMNS)
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to add equipment" };
  }
  return { equipment: data as unknown as KitchenEquipment };
}

export async function updateKitchenEquipment(
  id: string,
  patch: Partial<{
    name: string;
    category: KitchenEquipmentCategory;
    quantity: number;
    condition: KitchenEquipmentCondition;
    purchasedOn: string | null;
    replacementCost: number | null;
    notes: string | null;
    active: boolean;
  }>,
): Promise<{ equipment: KitchenEquipment } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.quantity !== undefined) update.quantity = patch.quantity;
  if (patch.condition !== undefined) update.condition = patch.condition;
  if (patch.purchasedOn !== undefined) update.purchased_on = patch.purchasedOn;
  if (patch.replacementCost !== undefined) update.replacement_cost = patch.replacementCost;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.active !== undefined) update.active = patch.active;

  const { data, error } = await supabase
    .from("kitchen_equipment")
    .update(update)
    .eq("id", id)
    .select(EQUIPMENT_COLUMNS)
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to update equipment" };
  }
  return { equipment: data as unknown as KitchenEquipment };
}

export async function listKitchenEquipmentMaintenanceLog(
  equipmentId: string,
): Promise<KitchenEquipmentMaintenanceLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_equipment_maintenance_log")
    .select("id, equipment_id, logged_on, description, cost, created_at")
    .eq("equipment_id", equipmentId)
    .order("logged_on", { ascending: false });
  if (error || !data) return [];
  return data as KitchenEquipmentMaintenanceLog[];
}

export async function createKitchenEquipmentMaintenanceLog(input: {
  equipmentId: string;
  description: string;
  cost?: number | null;
  loggedOn?: string;
  createdBy?: string | null;
}): Promise<{ entry: KitchenEquipmentMaintenanceLog } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_equipment_maintenance_log")
    .insert({
      equipment_id: input.equipmentId,
      description: input.description,
      cost: input.cost ?? null,
      logged_on: input.loggedOn ?? new Date().toISOString().slice(0, 10),
      created_by: input.createdBy ?? null,
    })
    .select("id, equipment_id, logged_on, description, cost, created_at")
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to log maintenance" };
  }
  return { entry: data as KitchenEquipmentMaintenanceLog };
}

// ── Vendors ──────────────────────────────────────────────────────────────────

export type KitchenVendor = {
  id: string;
  name: string;
  contact_person: string | null;
  contact_phone: string | null;
  notes: string | null;
  active: boolean;
};

export async function listKitchenVendors(): Promise<KitchenVendor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_vendors")
    .select("id, name, contact_person, contact_phone, notes, active")
    .eq("active", true)
    .order("name");
  if (error || !data) return [];
  return data as KitchenVendor[];
}

export async function createKitchenVendor(input: {
  name: string;
  contactPerson?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
}): Promise<{ vendor: KitchenVendor } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_vendors")
    .insert({
      name: input.name,
      contact_person: input.contactPerson ?? null,
      contact_phone: input.contactPhone ?? null,
      notes: input.notes ?? null,
    })
    .select("id, name, contact_person, contact_phone, notes, active")
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to add vendor" };
  }
  return { vendor: data as KitchenVendor };
}

// ── Menu planning (empty shell -- no real per-campus menu to seed) ─────────

export type KitchenMealSlot = "breakfast" | "lunch" | "snack" | "dinner";

export type KitchenMenuItem = {
  id: string;
  name: string;
  notes: string | null;
  active: boolean;
};

export type KitchenMenuPlan = {
  id: string;
  school_id: string;
  serve_date: string;
  meal_slot: KitchenMealSlot;
  menu_item_id: string;
  notes: string | null;
  menu_item_name?: string;
};

/** Returns both active and inactive items (inactive last) so the catalog UI
 * can offer a Reactivate control instead of the dish vanishing on deactivate
 * -- mirrors listKitchenStaffMembers's active-inclusive pattern. */
export async function listKitchenMenuItems(): Promise<KitchenMenuItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_menu_items")
    .select("id, name, notes, active")
    .order("active", { ascending: false })
    .order("name");
  if (error || !data) return [];
  return data as KitchenMenuItem[];
}

export async function createKitchenMenuItem(input: {
  name: string;
  notes?: string | null;
}): Promise<{ item: KitchenMenuItem } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_menu_items")
    .insert({ name: input.name, notes: input.notes ?? null })
    .select("id, name, notes, active")
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to add menu item" };
  }
  return { item: data as KitchenMenuItem };
}

export async function listKitchenMenuPlans(
  schoolId: string,
  startDate: string,
  endDate: string,
): Promise<KitchenMenuPlan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_menu_plans")
    .select(
      "id, school_id, serve_date, meal_slot, menu_item_id, notes, kitchen_menu_items(name)",
    )
    .eq("school_id", schoolId)
    .gte("serve_date", startDate)
    .lte("serve_date", endDate)
    .order("serve_date");
  if (error || !data) return [];

  return data.map((row) => {
    const { kitchen_menu_items, ...rest } = row as typeof row & {
      kitchen_menu_items?: { name: string } | { name: string }[] | null;
    };
    const item = Array.isArray(kitchen_menu_items) ? kitchen_menu_items[0] : kitchen_menu_items;
    return { ...rest, menu_item_name: item?.name } as KitchenMenuPlan;
  });
}

export type KitchenMenuPlanExportRow = KitchenMenuPlan & { school_name?: string };

/** Every scheduled dish across every campus/date, for CSV export -- not
 * scoped to one campus/date-range like listKitchenMenuPlans. */
export async function listAllKitchenMenuPlansForExport(): Promise<KitchenMenuPlanExportRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_menu_plans")
    .select(
      "id, school_id, serve_date, meal_slot, menu_item_id, notes, kitchen_menu_items(name), schools(name)",
    )
    .order("serve_date", { ascending: false });
  if (error || !data) return [];

  return data.map((row) => {
    const { kitchen_menu_items, schools, ...rest } = row as typeof row & {
      kitchen_menu_items?: { name: string } | { name: string }[] | null;
      schools?: { name: string } | { name: string }[] | null;
    };
    const item = Array.isArray(kitchen_menu_items) ? kitchen_menu_items[0] : kitchen_menu_items;
    const school = Array.isArray(schools) ? schools[0] : schools;
    return {
      ...rest,
      menu_item_name: item?.name,
      school_name: school?.name,
    } as KitchenMenuPlanExportRow;
  });
}

export async function createKitchenMenuPlan(input: {
  schoolId: string;
  serveDate: string;
  mealSlot: KitchenMealSlot;
  menuItemId: string;
  notes?: string | null;
  createdBy?: string | null;
}): Promise<{ plan: KitchenMenuPlan } | { error: string }> {
  const supabase = await createClient();

  // kitchen_menu_plans has no unique constraint on (school_id, serve_date,
  // meal_slot) yet -- that's queued as a pending schema change (see
  // pending_schema_changes memory) but not applied live, so a real upsert
  // targeting it would 42P10 the whole write today. Until it lands, enforce
  // "one plan per slot" at the app layer: if a plan already exists for this
  // exact slot, update it in place instead of inserting a second row.
  const { data: existing, error: existingError } = await supabase
    .from("kitchen_menu_plans")
    .select("id")
    .eq("school_id", input.schoolId)
    .eq("serve_date", input.serveDate)
    .eq("meal_slot", input.mealSlot)
    .maybeSingle();
  if (existingError) return { error: existingError.message };

  if (existing) {
    const { data, error } = await supabase
      .from("kitchen_menu_plans")
      .update({ menu_item_id: input.menuItemId, notes: input.notes ?? null })
      .eq("id", existing.id)
      .select("id, school_id, serve_date, meal_slot, menu_item_id, notes")
      .single();
    if (error || !data) {
      return { error: error?.message ?? "Failed to update menu plan" };
    }
    return { plan: data as KitchenMenuPlan };
  }

  const { data, error } = await supabase
    .from("kitchen_menu_plans")
    .insert({
      school_id: input.schoolId,
      serve_date: input.serveDate,
      meal_slot: input.mealSlot,
      menu_item_id: input.menuItemId,
      notes: input.notes ?? null,
      created_by: input.createdBy ?? null,
    })
    .select("id, school_id, serve_date, meal_slot, menu_item_id, notes")
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to add menu plan" };
  }
  return { plan: data as KitchenMenuPlan };
}

export async function deleteKitchenMenuPlan(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_menu_plans")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Menu plan not found or not permitted" };
  return { ok: true };
}

export async function updateKitchenMenuPlan(
  id: string,
  patch: Partial<{ menuItemId: string; notes: string | null }>,
): Promise<{ plan: KitchenMenuPlan } | { error: string }> {
  const supabase = await createClient();
  // kitchen_menu_plans has no updated_at column (see schema_kitchen.sql), unlike
  // most other kitchen tables -- don't stamp one.
  const update: Record<string, unknown> = {};
  if (patch.menuItemId !== undefined) update.menu_item_id = patch.menuItemId;
  if (patch.notes !== undefined) update.notes = patch.notes;

  const { data, error } = await supabase
    .from("kitchen_menu_plans")
    .update(update)
    .eq("id", id)
    .select("id, school_id, serve_date, meal_slot, menu_item_id, notes")
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to update menu plan" };
  }
  return { plan: data as KitchenMenuPlan };
}

// ── Waste tracking (empty shell -- no real data to seed) ────────────────────

export type KitchenWasteReason = "leftover" | "spoiled" | "prep_waste" | "other";

export type KitchenWasteLog = {
  id: string;
  school_id: string;
  logged_on: string;
  ingredient_id: string | null;
  item_name: string;
  quantity: number;
  unit: string;
  reason: KitchenWasteReason;
  notes: string | null;
};

export async function listKitchenWasteLogs(
  schoolId: string,
  startDate: string,
  endDate: string,
): Promise<KitchenWasteLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_waste_logs")
    .select("id, school_id, logged_on, ingredient_id, item_name, quantity, unit, reason, notes")
    .eq("school_id", schoolId)
    .gte("logged_on", startDate)
    .lte("logged_on", endDate)
    .order("logged_on", { ascending: false });
  if (error || !data) return [];
  return data as KitchenWasteLog[];
}

export type KitchenWasteLogExportRow = KitchenWasteLog & { school_name?: string };

/** Every waste log across every campus, for CSV export -- not scoped to one
 * campus/date-range like listKitchenWasteLogs. */
export async function listAllKitchenWasteLogsForExport(): Promise<KitchenWasteLogExportRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_waste_logs")
    .select(
      "id, school_id, logged_on, ingredient_id, item_name, quantity, unit, reason, notes, schools(name)",
    )
    .order("logged_on", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => {
    const { schools, ...rest } = row as typeof row & {
      schools?: { name: string } | { name: string }[] | null;
    };
    const school = Array.isArray(schools) ? schools[0] : schools;
    return { ...rest, school_name: school?.name } as KitchenWasteLogExportRow;
  });
}

export async function createKitchenWasteLog(input: {
  schoolId: string;
  itemName: string;
  ingredientId?: string | null;
  quantity: number;
  unit: string;
  reason: KitchenWasteReason;
  notes?: string | null;
  loggedOn?: string;
  createdBy?: string | null;
}): Promise<{ log: KitchenWasteLog } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_waste_logs")
    .insert({
      school_id: input.schoolId,
      item_name: input.itemName,
      ingredient_id: input.ingredientId ?? null,
      quantity: input.quantity,
      unit: input.unit,
      reason: input.reason,
      notes: input.notes ?? null,
      logged_on: input.loggedOn ?? new Date().toISOString().slice(0, 10),
      created_by: input.createdBy ?? null,
    })
    .select("id, school_id, logged_on, ingredient_id, item_name, quantity, unit, reason, notes")
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to log waste" };
  }
  return { log: data as KitchenWasteLog };
}

export async function deleteKitchenWasteLog(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_waste_logs")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Waste log not found or not permitted" };
  return { ok: true };
}

export async function updateKitchenWasteLog(
  id: string,
  patch: Partial<{
    itemName: string;
    quantity: number;
    unit: string;
    reason: KitchenWasteReason;
    notes: string | null;
  }>,
): Promise<{ log: KitchenWasteLog } | { error: string }> {
  const supabase = await createClient();

  const update: Record<string, unknown> = {};
  if (patch.itemName !== undefined) update.item_name = patch.itemName;
  if (patch.quantity !== undefined) update.quantity = patch.quantity;
  if (patch.unit !== undefined) update.unit = patch.unit;
  if (patch.reason !== undefined) update.reason = patch.reason;
  if (patch.notes !== undefined) update.notes = patch.notes;

  const { data, error } = await supabase
    .from("kitchen_waste_logs")
    .update(update)
    .eq("id", id)
    .select("id, school_id, logged_on, ingredient_id, item_name, quantity, unit, reason, notes")
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to update waste log" };
  }
  return { log: data as KitchenWasteLog };
}

// ── Meal attendance (standalone log, not a Transport/boarding pull -- see
// schema_kitchen.sql v11 header) ────────────────────────────────────────────

export type KitchenMealAttendance = {
  id: string;
  school_id: string;
  serve_date: string;
  meal_slot: KitchenMealSlot;
  actual_headcount: number;
  notes: string | null;
};

export async function listKitchenMealAttendance(
  schoolId: string,
  startDate: string,
  endDate: string,
): Promise<KitchenMealAttendance[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_meal_attendance")
    .select("id, school_id, serve_date, meal_slot, actual_headcount, notes")
    .eq("school_id", schoolId)
    .gte("serve_date", startDate)
    .lte("serve_date", endDate)
    .order("serve_date", { ascending: false });
  if (error || !data) return [];
  return data as KitchenMealAttendance[];
}

export type KitchenMealAttendanceExportRow = KitchenMealAttendance & { school_name?: string };

/** Every attendance entry across every campus, for CSV export -- not scoped
 * to one campus/date-range like listKitchenMealAttendance. */
export async function listAllKitchenMealAttendanceForExport(): Promise<
  KitchenMealAttendanceExportRow[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_meal_attendance")
    .select("id, school_id, serve_date, meal_slot, actual_headcount, notes, schools(name)")
    .order("serve_date", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => {
    const { schools, ...rest } = row as typeof row & {
      schools?: { name: string } | { name: string }[] | null;
    };
    const school = Array.isArray(schools) ? schools[0] : schools;
    return { ...rest, school_name: school?.name } as KitchenMealAttendanceExportRow;
  });
}

export async function upsertKitchenMealAttendance(input: {
  schoolId: string;
  serveDate: string;
  mealSlot: KitchenMealSlot;
  actualHeadcount: number;
  notes?: string | null;
  createdBy?: string | null;
}): Promise<{ attendance: KitchenMealAttendance } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_meal_attendance")
    .upsert(
      {
        school_id: input.schoolId,
        serve_date: input.serveDate,
        meal_slot: input.mealSlot,
        actual_headcount: input.actualHeadcount,
        notes: input.notes ?? null,
        created_by: input.createdBy ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "school_id,serve_date,meal_slot" },
    )
    .select("id, school_id, serve_date, meal_slot, actual_headcount, notes")
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to save meal attendance" };
  }
  return { attendance: data as KitchenMealAttendance };
}

export async function deleteKitchenMealAttendance(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_meal_attendance")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Meal attendance record not found or not permitted" };
  return { ok: true };
}

// ── Daycare (standalone, not per-campus -- see schema v13 header) ──────────
// kitchen_daycare_records / kitchen_inventory_counts below are brand-new
// tables (schema_kitchen.sql v13/v14) not yet applied live -- confirmed via
// a direct probe (PGRST205 "Could not find the table ... in the schema
// cache"). Reads already degrade gracefully (empty list); writes need a
// friendlier message than the raw Postgrest error, same fix as
// src/lib/db/revenue-targets.ts's friendlyError() for the same situation.
function friendlyTableMissingError(
  error: { code?: string; message: string } | null,
  fallback: string,
): string {
  if (error?.code === "PGRST205" || error?.message?.includes("Could not find the table")) {
    return "This isn't set up in the database yet -- ask Kai to run the pending migration.";
  }
  return error?.message ?? fallback;
}

export type KitchenDaycareRecord = {
  id: string;
  month: string;
  kid_count: number | null;
  monthly_cost: number | null;
  currency: string;
  menu_notes: string | null;
};

const DAYCARE_COLUMNS = "id, month, kid_count, monthly_cost, currency, menu_notes";

export async function listKitchenDaycareRecords(): Promise<KitchenDaycareRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_daycare_records")
    .select(DAYCARE_COLUMNS)
    .order("month", { ascending: false });
  if (error || !data) return [];
  return data as KitchenDaycareRecord[];
}

export async function upsertKitchenDaycareRecord(input: {
  month: string;
  kidCount?: number | null;
  monthlyCost?: number | null;
  currency?: string;
  menuNotes?: string | null;
  createdBy?: string | null;
}): Promise<{ record: KitchenDaycareRecord } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_daycare_records")
    .upsert(
      {
        month: input.month,
        kid_count: input.kidCount ?? null,
        monthly_cost: input.monthlyCost ?? null,
        currency: input.currency ?? "TZS",
        menu_notes: input.menuNotes ?? null,
        created_by: input.createdBy ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "month" },
    )
    .select(DAYCARE_COLUMNS)
    .single();
  if (error || !data) {
    return { error: friendlyTableMissingError(error, "Failed to save daycare record") };
  }
  return { record: data as KitchenDaycareRecord };
}

export async function deleteKitchenDaycareRecord(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_daycare_records")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { error: friendlyTableMissingError(error, "Failed to delete daycare record") };
  if (!data || data.length === 0) return { error: "Daycare record not found or not permitted" };
  return { ok: true };
}

// ── Inventory / stock on hand (per campus, see schema v14 header) ──────────

export type KitchenInventoryCount = {
  id: string;
  school_id: string;
  ingredient_id: string;
  counted_on: string;
  quantity_on_hand: number;
  notes: string | null;
};

const INVENTORY_COLUMNS =
  "id, school_id, ingredient_id, counted_on, quantity_on_hand, notes";

export async function listKitchenInventoryCounts(
  schoolId: string,
  startDate: string,
  endDate: string,
): Promise<KitchenInventoryCount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_counts")
    .select(INVENTORY_COLUMNS)
    .eq("school_id", schoolId)
    .gte("counted_on", startDate)
    .lte("counted_on", endDate)
    .order("counted_on", { ascending: false });
  if (error || !data) return [];
  return data as KitchenInventoryCount[];
}

export async function upsertKitchenInventoryCount(input: {
  schoolId: string;
  ingredientId: string;
  countedOn: string;
  quantityOnHand: number;
  notes?: string | null;
  createdBy?: string | null;
}): Promise<{ count: KitchenInventoryCount } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_counts")
    .upsert(
      {
        school_id: input.schoolId,
        ingredient_id: input.ingredientId,
        counted_on: input.countedOn,
        quantity_on_hand: input.quantityOnHand,
        notes: input.notes ?? null,
        created_by: input.createdBy ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "school_id,ingredient_id,counted_on" },
    )
    .select(INVENTORY_COLUMNS)
    .single();
  if (error || !data) {
    return { error: friendlyTableMissingError(error, "Failed to save inventory count") };
  }
  return { count: data as KitchenInventoryCount };
}

export async function deleteKitchenInventoryCount(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_counts")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { error: friendlyTableMissingError(error, "Failed to delete inventory count") };
  if (!data || data.length === 0) return { error: "Inventory count not found or not permitted" };
  return { ok: true };
}

// ── Nutrition & allergens (per ingredient, global -- see schema v12 header) ─

export type KitchenAllergen = { id: string; name: string };

export type KitchenIngredientNutrition = {
  ingredient_id: string;
  calories_per_100g: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  notes: string | null;
};

export async function listKitchenAllergens(): Promise<KitchenAllergen[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_allergens")
    .select("id, name")
    .order("name");
  if (error || !data) return [];
  return data as KitchenAllergen[];
}

export async function listKitchenIngredientAllergens(): Promise<
  Record<string, string[]>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_ingredient_allergens")
    .select("ingredient_id, allergen_id");
  if (error || !data) return {};
  const map: Record<string, string[]> = {};
  for (const row of data as { ingredient_id: string; allergen_id: string }[]) {
    if (!map[row.ingredient_id]) map[row.ingredient_id] = [];
    map[row.ingredient_id].push(row.allergen_id);
  }
  return map;
}

export async function setKitchenIngredientAllergens(
  ingredientId: string,
  allergenIds: string[],
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();

  // This table has no allergen-safety margin for a delete-then-insert order:
  // if the insert half failed after a blind delete, the ingredient would
  // briefly (or, on a real failure, permanently) show *zero* allergens --
  // the most dangerous possible wrong answer for a food-allergy feature.
  // Diff against the current set instead, insert the additions first, and
  // only delete the removals once the inserts are confirmed -- a failure
  // partway through leaves the data in an over-cautious state (extra
  // allergens still listed), never an under-cautious one.
  const { data: currentRows, error: readError } = await supabase
    .from("kitchen_ingredient_allergens")
    .select("allergen_id")
    .eq("ingredient_id", ingredientId);
  if (readError) return { error: readError.message };

  const current = new Set((currentRows ?? []).map((row) => row.allergen_id as string));
  const next = new Set(allergenIds);
  const toAdd = allergenIds.filter((id) => !current.has(id));
  const toRemove = [...current].filter((id) => !next.has(id));

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("kitchen_ingredient_allergens")
      .insert(toAdd.map((allergenId) => ({ ingredient_id: ingredientId, allergen_id: allergenId })));
    if (error) return { error: error.message };
  }

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("kitchen_ingredient_allergens")
      .delete()
      .eq("ingredient_id", ingredientId)
      .in("allergen_id", toRemove);
    if (error) return { error: error.message };
  }

  return { ok: true };
}

export async function listKitchenIngredientNutrition(): Promise<
  Record<string, KitchenIngredientNutrition>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_ingredient_nutrition")
    .select("ingredient_id, calories_per_100g, protein_g, carbs_g, fat_g, fiber_g, notes");
  if (error || !data) return {};
  const map: Record<string, KitchenIngredientNutrition> = {};
  for (const row of data as KitchenIngredientNutrition[]) {
    map[row.ingredient_id] = row;
  }
  return map;
}

export async function upsertKitchenIngredientNutrition(input: {
  ingredientId: string;
  caloriesPer100g?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  fiberG?: number | null;
  notes?: string | null;
}): Promise<{ nutrition: KitchenIngredientNutrition } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_ingredient_nutrition")
    .upsert(
      {
        ingredient_id: input.ingredientId,
        calories_per_100g: input.caloriesPer100g ?? null,
        protein_g: input.proteinG ?? null,
        carbs_g: input.carbsG ?? null,
        fat_g: input.fatG ?? null,
        fiber_g: input.fiberG ?? null,
        notes: input.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "ingredient_id" },
    )
    .select("ingredient_id, calories_per_100g, protein_g, carbs_g, fat_g, fiber_g, notes")
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to save nutrition data" };
  }
  return { nutrition: data as KitchenIngredientNutrition };
}

// ── CRUD-completeness additions ─────────────────────────────────────────────

export async function updateKitchenVendor(
  id: string,
  patch: Partial<{
    name: string;
    contactPerson: string | null;
    contactPhone: string | null;
    notes: string | null;
    active: boolean;
  }>,
): Promise<{ vendor: KitchenVendor } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.contactPerson !== undefined) update.contact_person = patch.contactPerson;
  if (patch.contactPhone !== undefined) update.contact_phone = patch.contactPhone;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.active !== undefined) update.active = patch.active;

  const { data, error } = await supabase
    .from("kitchen_vendors")
    .update(update)
    .eq("id", id)
    .select("id, name, contact_person, contact_phone, notes, active")
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to update vendor" };
  }
  return { vendor: data as KitchenVendor };
}

export async function updateKitchenMenuItem(
  id: string,
  patch: Partial<{ name: string; notes: string | null; active: boolean }>,
): Promise<{ item: KitchenMenuItem } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) return { error: "name cannot be blank" };
    update.name = trimmed;
  }
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.active !== undefined) update.active = patch.active;

  const { data, error } = await supabase
    .from("kitchen_menu_items")
    .update(update)
    .eq("id", id)
    .select("id, name, notes, active")
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to update menu item" };
  }
  return { item: data as KitchenMenuItem };
}

export async function createKitchenSupply(input: {
  name: string;
  unit: string;
  defaultUnitPrice: number;
}): Promise<{ supply: KitchenSupply } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitchen_supplies")
    .insert({
      name: input.name,
      unit: input.unit,
      default_unit_price: input.defaultUnitPrice,
    })
    .select("id, name, unit, default_unit_price, active")
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to add supply" };
  }
  return { supply: data as KitchenSupply };
}

export async function updateKitchenSupply(
  id: string,
  patch: Partial<{ name: string; unit: string; defaultUnitPrice: number; active: boolean }>,
): Promise<{ supply: KitchenSupply } | { error: string }> {
  const supabase = await createClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.unit !== undefined) update.unit = patch.unit;
  if (patch.defaultUnitPrice !== undefined) update.default_unit_price = patch.defaultUnitPrice;
  if (patch.active !== undefined) update.active = patch.active;

  const { data, error } = await supabase
    .from("kitchen_supplies")
    .update(update)
    .eq("id", id)
    .select("id, name, unit, default_unit_price, active")
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to update supply" };
  }
  return { supply: data as KitchenSupply };
}
