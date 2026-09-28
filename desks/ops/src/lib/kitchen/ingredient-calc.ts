import type { KitchenIngredient, KitchenIngredientCampusSetting } from "@/lib/db/kitchen";

export type KitchenHeadcountLineInput = {
  headcount: number;
  daysInPeriod: number;
};

export type IngredientRequirement = {
  ingredient: KitchenIngredient;
  requiredQuantity: number;
  estimatedCost: number;
};

/** Every headcount line contributes headcount x days-in-its-own-period —
 * this uniformly covers day/boarding/weekday/weekend/holiday/cross-campus
 * categories without the calculation branching on category at all. */
export function totalPersonDays(lines: KitchenHeadcountLineInput[]): number {
  return lines.reduce((sum, l) => sum + l.headcount * l.daysInPeriod, 0);
}

export function calendarDaysInMonth(monthValue: string): number {
  const [year, month] = monthValue.split("-").map(Number);
  if (!year || !month) return 0;
  return new Date(year, month, 0).getDate();
}

function effectivePeoplePerKg(
  ingredient: KitchenIngredient,
  campusSetting: KitchenIngredientCampusSetting | undefined,
): number | null {
  return campusSetting?.people_per_kg ?? ingredient.people_per_kg;
}

function effectiveKgPerWeek(
  ingredient: KitchenIngredient,
  campusSetting: KitchenIngredientCampusSetting | undefined,
): number | null {
  return campusSetting?.kg_per_week ?? ingredient.kg_per_week;
}

function effectiveWeeksInMonth(
  campusSetting: KitchenIngredientCampusSetting | undefined,
  monthValue: string,
): number {
  if (campusSetting?.weeks_in_month) return campusSetting.weeks_in_month;
  return calendarDaysInMonth(monthValue) / 7;
}

export function requiredQuantity(
  ingredient: KitchenIngredient,
  campusSetting: KitchenIngredientCampusSetting | undefined,
  personDays: number,
  monthValue: string,
): number {
  if (ingredient.calc_method === "flat_weekly") {
    const kgPerWeek = effectiveKgPerWeek(ingredient, campusSetting);
    if (!kgPerWeek) return 0;
    return kgPerWeek * effectiveWeeksInMonth(campusSetting, monthValue);
  }

  const peoplePerKg = effectivePeoplePerKg(ingredient, campusSetting);
  if (!peoplePerKg) return 0;
  return personDays / peoplePerKg;
}

export function buildIngredientRequirements(
  ingredients: KitchenIngredient[],
  campusSettingsByIngredientId: Map<string, KitchenIngredientCampusSetting>,
  effectivePricesByIngredientId: Map<string, number>,
  headcountLines: KitchenHeadcountLineInput[],
  monthValue: string,
): IngredientRequirement[] {
  const personDays = totalPersonDays(headcountLines);

  return ingredients
    .filter((i) => i.active)
    .map((ingredient) => {
      const campusSetting = campusSettingsByIngredientId.get(ingredient.id);
      const qty = requiredQuantity(ingredient, campusSetting, personDays, monthValue);
      const unitPrice =
        effectivePricesByIngredientId.get(ingredient.id) ?? ingredient.default_unit_price;
      return {
        ingredient,
        requiredQuantity: qty,
        estimatedCost: qty * unitPrice,
      };
    });
}
