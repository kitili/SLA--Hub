import Link from "next/link";
import { KitchenDaycareClient } from "@/components/kitchen/KitchenDaycareClient";
import { KitchenSubnav } from "@/components/kitchen/KitchenSubnav";

export default function KitchenDaycarePage() {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Kitchen</h1>
          <p className="mt-2 max-w-2xl text-ink-muted">
            Daycare — kid count, menu notes, and monthly cost. Not one of the 5 campuses.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm font-semibold text-electric-blue no-underline hover:underline"
        >
          ← Dashboards
        </Link>
      </div>

      <KitchenSubnav active="daycare" />
      <KitchenDaycareClient />
    </div>
  );
}
