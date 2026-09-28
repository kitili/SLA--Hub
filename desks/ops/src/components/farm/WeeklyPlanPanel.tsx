"use client";

import { useMemo, useState } from "react";
import type { FarmScheduleStage, FarmScheduleWeek } from "@/lib/db/farm";

const STAGE_LABEL: Record<FarmScheduleStage, string> = {
  ON: "In production",
  OFF: "Idle",
  FPR: "Prep",
  PLT: "Plant",
  WDN: "Weed",
  INS: "Insecticide",
  FTL: "Fertilizer",
  HVT: "Harvest",
};

const STAGES = Object.keys(STAGE_LABEL) as FarmScheduleStage[];

type Props = {
  weeks: FarmScheduleWeek[];
};

export function WeeklyPlanPanel({ weeks: initialWeeks }: Props) {
  const [weeks, setWeeks] = useState(initialWeeks);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { bySection, weekDates } = useMemo(() => {
    const bySection = new Map<
      string,
      { crop: string | null; plot: string | null; cells: FarmScheduleWeek[] }
    >();
    for (const week of weeks) {
      const key = week.section_code ?? week.section_id;
      const bucket = bySection.get(key) ?? {
        crop: week.crop ?? null,
        plot: week.plot_code ?? null,
        cells: [],
      };
      bucket.cells.push(week);
      bySection.set(key, bucket);
    }
    const weekDates = Array.from(new Set(weeks.map((w) => w.week_of))).sort();
    return { bySection, weekDates };
  }, [weeks]);

  async function saveCell(cell: FarmScheduleWeek, stageCode: FarmScheduleStage) {
    if (cell.stage_code === stageCode) return;
    const key = `${cell.section_id}|${cell.week_of}`;
    setSavingKey(key);
    setError(null);
    try {
      const res = await fetch("/api/farm/schedule-weeks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: cell.section_id,
          weekOf: cell.week_of,
          stageCode,
        }),
      });
      const data = (await res.json()) as { week?: FarmScheduleWeek; error?: string };
      if (!res.ok || !data.week) {
        setError(data.error ?? "Failed to save plan cell");
        return;
      }
      setWeeks((prev) =>
        prev.map((w) => (w.id === data.week!.id ? data.week! : w)),
      );
    } catch {
      setError("Network error saving plan cell");
    } finally {
      setSavingKey(null);
    }
  }

  if (weeks.length === 0) {
    return (
      <section className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Live weekly plan
        </h2>
        <p className="mt-2 text-sm text-ink-faint">
          No weekly plan rows yet. Run the Usa River farm import once to seed
          sections, then edit stages here — Ops is the live sheet going forward.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-success">
            Live sheet
          </p>
          <h2 className="mt-0.5 text-sm font-semibold uppercase tracking-wide text-ink-muted">
            2026 weekly plan ({bySection.size} sections)
          </h2>
          <p className="mt-1 text-xs text-ink-faint">
            Edit stage codes here. Actual field work is still logged as activities
            below.
          </p>
        </div>
        {savingKey ? (
          <p className="text-xs font-semibold text-ink-muted">Saving…</p>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr className="text-ink-muted">
              <th className="sticky left-0 bg-card px-2 py-2">Section</th>
              <th className="px-2 py-2">Crop</th>
              {weekDates.map((d) => (
                <th key={d} className="whitespace-nowrap px-2 py-2">
                  {d.slice(5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from(bySection.entries()).map(([code, row]) => {
              const byDate = new Map(row.cells.map((c) => [c.week_of, c]));
              return (
                <tr key={code} className="border-t border-card-border">
                  <td className="sticky left-0 bg-card px-2 py-2 font-semibold text-ink">
                    {code}
                    {row.plot ? (
                      <span className="ml-1 font-normal text-ink-faint">
                        (Farm {row.plot})
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 text-ink-muted">{row.crop ?? "—"}</td>
                  {weekDates.map((d) => {
                    const cell = byDate.get(d);
                    if (!cell) {
                      return (
                        <td key={d} className="px-2 py-2 text-ink-faint">
                          ·
                        </td>
                      );
                    }
                    const busy = savingKey === `${cell.section_id}|${cell.week_of}`;
                    return (
                      <td key={d} className="px-1 py-1">
                        <select
                          value={cell.stage_code}
                          disabled={busy}
                          title={STAGE_LABEL[cell.stage_code]}
                          onChange={(e) =>
                            void saveCell(cell, e.target.value as FarmScheduleStage)
                          }
                          className="max-w-[4.5rem] rounded border border-card-border bg-white px-1 py-0.5 font-semibold text-ink disabled:opacity-60"
                        >
                          {STAGES.map((stage) => (
                            <option key={stage} value={stage}>
                              {stage}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
