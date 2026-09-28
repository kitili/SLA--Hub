import { listPlots, listWalkthroughs } from "@/lib/db/farm";
import { FarmSubnav } from "@/components/farm/FarmSubnav";
import { WalkthroughsClient } from "@/components/farm/WalkthroughsClient";

export default async function FarmWalkthroughsPage() {
  const [plots, walkthroughs] = await Promise.all([
    listPlots(),
    listWalkthroughs(),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-electric-blue">
        Admin · Farm
      </p>
      <h1 className="mt-1 text-2xl font-bold text-electric-blue">
        Weekly walkthroughs
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Log the weekly quality checklist per plot — replaces the manual
        walkthrough tab, now with a trend you can actually see.
      </p>

      <FarmSubnav active="walkthroughs" />

      <div className="mt-2">
        <WalkthroughsClient plots={plots} initialWalkthroughs={walkthroughs} />
      </div>
    </main>
  );
}
