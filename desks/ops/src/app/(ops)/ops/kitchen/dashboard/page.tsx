import Link from "next/link";
import { getKitchenModuleCounts, listRecentKitchenPurchases } from "@/lib/db/kitchen";
import {
  getKitchenCampusSummaries,
  getKitchenLeadershipKpis,
} from "@/lib/kitchen/kitchen-kpis";
import { KitchenCampusSummaryGrid } from "@/components/kitchen/KitchenCampusSummaryGrid";
import { KitchenKpiPanel } from "@/components/kitchen/KitchenKpiPanel";
import { KitchenModuleStatsGrid } from "@/components/kitchen/KitchenModuleStatsGrid";
import { KitchenModulesGrid } from "@/components/kitchen/KitchenModulesGrid";
import { KitchenRecentPurchasesFeed } from "@/components/kitchen/KitchenRecentPurchasesFeed";
import { KitchenSubnav } from "@/components/kitchen/KitchenSubnav";
import { LiveSheetBanner } from "@/components/ops/LiveSheetBanner";

export default async function KitchenLeadershipDashboardPage() {
  const [result, summaries, counts, recentPurchases] = await Promise.all([
    getKitchenLeadershipKpis(),
    getKitchenCampusSummaries(),
    getKitchenModuleCounts(),
    listRecentKitchenPurchases(10),
  ]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Kitchen</h1>
          <p className="mt-2 max-w-2xl text-ink-muted">
            Live Kitchen Top Sheet — campus summaries, module stats, and recent activity.
            Use the tabs above for Compliance, Food quality, Procurement, and every other
            working page.
          </p>
        </div>
        <Link
          href="/ops"
          className="text-sm font-semibold text-electric-blue no-underline hover:underline"
        >
          ← Dashboards
        </Link>
      </div>

      <KitchenSubnav active="dashboard" />
      <LiveSheetBanner
        domain="Kitchen"
        detail="Headcount, purchases, budgets, checklists, and surveys are entered in Ops — the Excel master is archive/import only."
      />
      <KitchenKpiPanel kpis={result.kpis} error={result.error} />
      <KitchenCampusSummaryGrid summaries={summaries} />
      <KitchenModuleStatsGrid counts={counts} />
      <KitchenRecentPurchasesFeed purchases={recentPurchases} />
      <KitchenModulesGrid />
    </div>
  );
}
