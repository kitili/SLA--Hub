"use client";

import { useEffect, useMemo, useState } from "react";
import type { School } from "@/types/database";
import type {
  KitchenChecklistCadence,
  KitchenChecklistEntry,
  KitchenChecklistTemplate,
  KitchenSopTask,
} from "@/lib/db/kitchen";
import { CHECKLIST_TARGET_PCT, checklistPeriodScorePct } from "@/lib/kitchen/checklist-score";

type Props = {
  schools: School[];
};

const CADENCE_LABELS: Record<KitchenChecklistCadence, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function mondayOfWeek(d: Date) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday;
}

function firstOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function KitchenComplianceReview({ schools }: Props) {
  const [templates, setTemplates] = useState<KitchenChecklistTemplate[]>([]);
  const [entries, setEntries] = useState<KitchenChecklistEntry[]>([]);
  const [sopTasks, setSopTasks] = useState<KitchenSopTask[]>([]);
  const [showSop, setShowSop] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const periods = useMemo(() => {
    const today = new Date();
    const weekStart = isoDate(mondayOfWeek(today));
    return { daily: weekStart, weekly: weekStart, monthly: isoDate(firstOfMonth(today)) };
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const periodDates = Array.from(new Set(Object.values(periods))).join(",");
        const schoolIds = schools.map((s) => s.id).join(",");
        const [templatesRes, entriesRes, sopRes] = await Promise.all([
          fetch("/api/kitchen/checklist-templates"),
          schools.length > 0
            ? fetch(
                `/api/kitchen/checklist-entries?schoolId=${encodeURIComponent(schoolIds)}&periodDates=${encodeURIComponent(periodDates)}`,
              )
            : Promise.resolve(null),
          fetch("/api/kitchen/sop-tasks"),
        ]);
        const templatesData = (await templatesRes.json()) as {
          templates?: KitchenChecklistTemplate[];
          error?: string;
        };
        const entriesData = entriesRes
          ? ((await entriesRes.json()) as { entries?: KitchenChecklistEntry[]; error?: string })
          : { entries: [] as KitchenChecklistEntry[] };
        const sopData = (await sopRes.json()) as { tasks?: KitchenSopTask[]; error?: string };

        if (!templatesRes.ok) {
          setError(templatesData.error ?? "Failed to load checklist templates");
        } else if (entriesRes && !entriesRes.ok) {
          setError(entriesData.error ?? "Failed to load checklist entries");
        } else if (!sopRes.ok) {
          setError(sopData.error ?? "Failed to load SOP tasks");
        }

        setTemplates(templatesData.templates ?? []);
        setEntries(entriesData.entries ?? []);
        setSopTasks(sopData.tasks ?? []);
      } catch {
        setError("Network error loading compliance data");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [schools, periods]);

  function scoreForSchool(schoolId: string, cadence: KitchenChecklistCadence) {
    const relevantTemplateIds = new Set(
      templates.filter((t) => t.cadence === cadence).map((t) => t.id),
    );
    const schoolEntries = entries.filter(
      (e) => e.school_id === schoolId && relevantTemplateIds.has(e.template_id),
    );
    return checklistPeriodScorePct(cadence, schoolEntries);
  }

  return (
    <section className="ui-rise rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
        Compliance
      </p>
      <h2 className="mt-1 font-display text-lg font-bold text-ink">Checklist scores — this period</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Daily / weekly / monthly scores per campus from the /kitchen cook app. Templates are
        seeded (28 items); entries start empty until cooks submit. Target 90%.
      </p>

      {error ? (
        <p className="mt-3 text-sm text-danger">{error}</p>
      ) : loading ? (
        <p className="mt-3 text-sm text-ink-muted">Loading…</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase text-ink-muted">
                <th className="pb-2">Campus</th>
                {(Object.keys(CADENCE_LABELS) as KitchenChecklistCadence[]).map((c) => (
                  <th key={c} className="pb-2">
                    {CADENCE_LABELS[c]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {schools.map((school) => (
                <tr key={school.id}>
                  <td className="py-2 font-semibold text-ink">{school.name}</td>
                  {(Object.keys(CADENCE_LABELS) as KitchenChecklistCadence[]).map((c) => {
                    const pct = scoreForSchool(school.id, c);
                    return (
                      <td
                        key={c}
                        title={pct === null ? "No data yet" : undefined}
                        className={`py-2 font-bold ${
                          pct === null
                            ? "text-ink-faint"
                            : pct >= CHECKLIST_TARGET_PCT
                              ? "text-success"
                              : "text-danger"
                        }`}
                      >
                        {pct !== null ? `${Math.round(pct * 100)}%` : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-ink-faint">— = no data yet, not a zero score.</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowSop((v) => !v)}
        className="mt-4 text-sm font-semibold text-electric-blue hover:underline"
      >
        {showSop ? "Hide" : "Show"} SOP reference ({sopTasks.length} tasks)
      </button>

      {showSop ? (
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {sopTasks.map((task) => (
            <li key={task.id} className="rounded-[var(--radius-sm)] border border-card-border p-3">
              <span className="text-xs font-bold uppercase text-ink-muted">
                {task.role.replace(/_/g, " ")} · {task.cadence}
              </span>
              <p className="mt-1 text-ink">{task.description}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
