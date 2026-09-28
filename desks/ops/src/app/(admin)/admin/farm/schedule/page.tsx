import {
  listActivities,
  listCropPlantings,
  listPlots,
  listScheduleWeeks,
} from "@/lib/db/farm";
import { FarmSubnav } from "@/components/farm/FarmSubnav";
import { ScheduleClient } from "@/components/farm/ScheduleClient";
import { WeeklyPlanPanel } from "@/components/farm/WeeklyPlanPanel";
import { LiveSheetBanner } from "@/components/ops/LiveSheetBanner";

export default async function FarmSchedulePage() {
  const [plots, plantings, activities, weeks] = await Promise.all([
    listPlots(),
    listCropPlantings(),
    listActivities(),
    listScheduleWeeks({ from: "2026-06-01", to: "2026-12-31" }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-electric-blue">
        Admin · Farm
      </p>
      <h1 className="mt-1 text-2xl font-bold text-electric-blue">
        Farm schedule
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Live weekly plan plus day-to-day tasks. Overdue activities raise SMS
        alerts via the farm-alerts cron.
      </p>
      <FarmSubnav active="schedule" />

      <div className="mt-2">
        <LiveSheetBanner
          domain="Farm"
          detail="Edit the weekly plan grid below — do not update the Excel master for live ops."
        />
      </div>

      <div className="mt-6">
        <WeeklyPlanPanel weeks={weeks} />
      </div>

      <div className="mt-8">
        <ScheduleClient
          plots={plots}
          plantings={plantings}
          initialActivities={activities}
        />
      </div>
    </main>
  );
}
