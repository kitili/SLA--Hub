import { listPlots, listCropPlantings, listHarvests } from "@/lib/db/farm";
import { FarmSubnav } from "@/components/farm/FarmSubnav";
import { HarvestsClient } from "@/components/farm/HarvestsClient";

export default async function FarmHarvestsPage() {
  const [plots, plantings, harvests] = await Promise.all([
    listPlots(),
    listCropPlantings(),
    listHarvests(),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-electric-blue">
        Admin · Farm
      </p>
      <h1 className="mt-1 text-2xl font-bold text-electric-blue">Harvests</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Log yield, value, and destination per harvest — replaces the manual
        Farm P&amp;L tab and feeds the kitchen food-cost ROI comparison.
      </p>

      <FarmSubnav active="harvests" />

      <div className="mt-2">
        <HarvestsClient
          plots={plots}
          plantings={plantings}
          initialHarvests={harvests}
        />
      </div>
    </main>
  );
}
