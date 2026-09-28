import {
  getFarmPnL,
  listHarvests,
  listPlots,
  listScheduleWeeks,
  listWalkthroughs,
} from "@/lib/db/farm";
import { createClient } from "@/lib/supabase/server";
import { FarmSubnav } from "@/components/farm/FarmSubnav";
import { LiveSheetBanner } from "@/components/ops/LiveSheetBanner";

function money(n: number, currency = "TZS") {
  return `${currency} ${Math.round(n).toLocaleString()}`;
}

export default async function FarmOverviewPage() {
  const today = new Date().toISOString().slice(0, 10);
  const year = today.slice(0, 4);
  const ytdFrom = `${year}-01-01`;
  const mtdFrom = `${today.slice(0, 7)}-01`;
  const scheduleFrom = today.slice(0, 8) + "01";
  const scheduleTo = today.slice(0, 8) + "28";

  const [ytd, mtd, plots, harvests, walkthroughs, scheduleWeeks, alertsRes] =
    await Promise.all([
      getFarmPnL({ from: ytdFrom, to: today }),
      getFarmPnL({ from: mtdFrom, to: today }),
      listPlots(),
      listHarvests({ from: ytdFrom, to: today }),
      listWalkthroughs({ limit: 8 }),
      listScheduleWeeks({ from: scheduleFrom, to: scheduleTo }),
      (async () => {
        const supabase = await createClient();
        const { data } = await supabase
          .from("farm_alerts")
          .select("id, kind, message, status, created_at")
          .in("status", ["open", "notified"])
          .order("created_at", { ascending: false })
          .limit(10);
        return data ?? [];
      })(),
    ]);

  const plotsByStatus = plots.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});
  const totalAcreage = plots.reduce((s, p) => s + p.acreage, 0);
  const activeAcreage = plots
    .filter((p) => p.status === "active")
    .reduce((s, p) => s + p.acreage, 0);
  const utilization =
    totalAcreage > 0 ? Math.round((activeAcreage / totalAcreage) * 1000) / 10 : 0;
  const latestWalk = walkthroughs[0];
  const recentHarvests = harvests.slice(0, 6);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-electric-blue">
        Admin · Farm
      </p>
      <h1 className="mt-1 text-2xl font-bold text-electric-blue">
        Farm overview
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Live Usa River farm dashboard — year-to-date savings, plot utilisation,
        this month&apos;s schedule, and recent harvests. Excel is import/archive
        only.
      </p>
      <div className="mt-4">
        <LiveSheetBanner
          domain="Farm"
          detail="Plots, schedule, expenses, harvests, and walkthroughs are edited here — not in the Excel master."
        />
      </div>

      {ytd.harvest_count === 0 && ytd.total_expense === 0 ? (
        <p className="mt-4 rounded-[var(--radius-sm)] border border-gold/40 bg-gold-15 px-4 py-3 text-sm text-ink-muted">
          No harvest or expense rows returned for {ytdFrom}–{today}. If Plots
          load but these stay at zero, hard-refresh after deploy, or confirm
          your account role is admin, finance, or farm (RLS blocks other roles).
          August month-to-date is currently empty by design — values are on
          year-to-date.
        </p>
      ) : null}

      <div className="mt-4">
        <FarmSubnav active="hub" />
      </div>

      <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="ui-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">
            Net savings (YTD)
          </p>
          <p className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink">
            {money(ytd.net_savings)}
          </p>
          <p className="mt-1 text-[11px] text-ink-faint">
            This month {money(mtd.net_savings)}
            {mtd.harvest_count === 0 && mtd.total_expense === 0
              ? " · no August rows yet"
              : ""}
          </p>
        </article>
        <article className="ui-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">
            Harvest value (YTD)
          </p>
          <p className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink">
            {money(ytd.total_harvest_value)}
          </p>
          <p className="mt-1 text-[11px] text-ink-faint">
            Kitchen use {money(ytd.kitchen_value)}
          </p>
        </article>
        <article className="ui-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">
            Expenses (YTD)
          </p>
          <p className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink">
            {money(ytd.total_expense)}
          </p>
          <p className="mt-1 text-[11px] text-ink-faint">
            Yield {Math.round(ytd.total_yield_kg).toLocaleString()} kg
          </p>
        </article>
        <article className="ui-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">
            Site utilisation
          </p>
          <p className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink">
            {utilization}%
          </p>
          <p className="mt-1 text-[11px] text-ink-faint">
            {activeAcreage.toFixed(2)} / {totalAcreage.toFixed(2)} acres active
          </p>
        </article>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="ui-panel p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-electric-blue">
            Plots ({plots.length}) · {totalAcreage.toFixed(2)} acres
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm text-ink">
            {(["active", "staged", "fallow", "retired"] as const).map((status) => (
              <li key={status} className="flex items-center justify-between">
                <span className="capitalize text-ink-muted">{status}</span>
                <span className="font-semibold">{plotsByStatus[status] ?? 0}</span>
              </li>
            ))}
          </ul>
          <ul className="mt-4 space-y-1 text-sm">
            {plots.map((p) => (
              <li key={p.id} className="flex justify-between gap-3">
                <span className="font-semibold text-ink">
                  {p.code}
                  {p.name ? ` · ${p.name}` : ""}
                </span>
                <span className="text-ink-muted">
                  {p.acreage} ac · {p.status}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="ui-panel p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-electric-blue">
            This month&apos;s plan ({scheduleWeeks.length} week cells)
          </h2>
          {scheduleWeeks.length === 0 ? (
            <p className="mt-3 text-sm text-ink-faint">
              Weekly schedule not loaded yet. Open Schedule after the 2026 plan
              import finishes.
            </p>
          ) : (
            <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto text-sm">
              {scheduleWeeks.slice(0, 24).map((w) => (
                <li key={w.id} className="flex justify-between gap-2">
                  <span className="font-semibold text-ink">
                    {w.section_code ?? "—"} · {w.crop ?? "crop"}
                  </span>
                  <span className="text-ink-muted">
                    {w.week_of} · {w.stage_code}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink-faint">
            Latest walkthrough score:{" "}
            {latestWalk?.overall_score != null
              ? `${Math.round(latestWalk.overall_score * 100)}%`
              : "—"}
            {latestWalk ? ` (${latestWalk.week_of})` : ""}
          </p>
        </section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="ui-panel p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-electric-blue">
            Recent harvests
          </h2>
          {recentHarvests.length === 0 ? (
            <p className="mt-3 text-sm text-ink-faint">No harvests logged yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {recentHarvests.map((h) => (
                <li
                  key={h.id}
                  className="flex items-start justify-between gap-3 border-b border-card-border pb-2 last:border-0"
                >
                  <div>
                    <p className="font-semibold text-ink">
                      {h.notes?.replace(/\s*\(2026 Farms Master Sheet import\)/, "") ??
                        "Harvest"}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {h.harvested_on} · {h.quantity_kg.toLocaleString()} kg ·{" "}
                      {h.destination}
                    </p>
                  </div>
                  <p className="font-semibold text-electric-blue">
                    {h.value_amount != null ? money(h.value_amount) : "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ui-panel p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-electric-blue">
            Open alerts ({alertsRes.length})
          </h2>
          {alertsRes.length === 0 ? (
            <p className="mt-3 text-sm text-ink-faint">
              No overdue tasks, budget overruns, or low-stock alerts.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {alertsRes.map((a) => (
                <li
                  key={a.id}
                  className="rounded-[var(--radius-sm)] border border-card-border bg-danger-15 px-3 py-2 text-ink"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-danger">
                    {a.kind.replace("_", " ")}
                  </span>
                  <p className="mt-0.5">{a.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
