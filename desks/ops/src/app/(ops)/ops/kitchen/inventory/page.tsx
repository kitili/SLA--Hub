import Link from "next/link";
import { getSchools } from "@/lib/db/queries";
import { listKitchenIngredients } from "@/lib/db/kitchen";
import { KitchenInventoryClient } from "@/components/kitchen/KitchenInventoryClient";
import { KitchenSubnav } from "@/components/kitchen/KitchenSubnav";

export default async function KitchenInventoryPage() {
  const [schoolsRaw, ingredients] = await Promise.all([
    getSchools(),
    listKitchenIngredients(),
  ]);
  const schools = [...schoolsRaw].sort((a, b) => {
    const score = (s: { name: string; slug: string }) =>
      /usariver|usa\s*river/i.test(`${s.name} ${s.slug}`) ? 0 : 1;
    return score(a) - score(b) || a.name.localeCompare(b.name);
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Kitchen</h1>
          <p className="mt-2 max-w-2xl text-ink-muted">
            Inventory — stock on hand, per campus, per ingredient.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm font-semibold text-electric-blue no-underline hover:underline"
        >
          ← Dashboards
        </Link>
      </div>

      <KitchenSubnav active="inventory" />
      <KitchenInventoryClient schools={schools} ingredients={ingredients} />
    </div>
  );
}
