import { listPlots, listCropPlantings } from "@/lib/db/farm";
import { FarmSubnav } from "@/components/farm/FarmSubnav";
import { PlotsClient } from "@/components/farm/PlotsClient";

export default async function FarmPlotsPage() {
  const [plots, plantings] = await Promise.all([
    listPlots(),
    listCropPlantings(),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-electric-blue">
        Admin · Farm
      </p>
      <h1 className="mt-1 text-2xl font-bold text-electric-blue">
        Plots &amp; crop plantings
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Manage the 8+ acre plot roster (A–J) and per-plot crop cycles —
        replaces the manual Site Utilisation &amp; Staging and Crop Inventory
        tabs.
      </p>

      <FarmSubnav active="plots" />

      <div className="mt-2">
        <PlotsClient initialPlots={plots} initialPlantings={plantings} />
      </div>
    </main>
  );
}
