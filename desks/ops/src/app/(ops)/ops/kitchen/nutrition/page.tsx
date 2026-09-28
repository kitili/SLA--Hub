import Link from "next/link";
import { listKitchenIngredients } from "@/lib/db/kitchen";
import { KitchenNutritionClient } from "@/components/kitchen/KitchenNutritionClient";
import { KitchenSubnav } from "@/components/kitchen/KitchenSubnav";

export default async function KitchenNutritionPage() {
  const ingredients = await listKitchenIngredients();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Kitchen</h1>
          <p className="mt-2 max-w-2xl text-ink-muted">
            Nutrition and allergen facts, per ingredient — same catalog everywhere, not
            per-campus.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm font-semibold text-electric-blue no-underline hover:underline"
        >
          ← Dashboards
        </Link>
      </div>

      <KitchenSubnav active="nutrition" />
      <KitchenNutritionClient ingredients={ingredients} />
    </div>
  );
}
