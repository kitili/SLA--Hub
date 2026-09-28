"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { School } from "@/types/database";
import type {
  KitchenChecklistCadence,
  KitchenChecklistEntry,
  KitchenChecklistTemplate,
} from "@/lib/db/kitchen";
import { CHECKLIST_TARGET_PCT, checklistCompleteness } from "@/lib/kitchen/checklist-score";
import { useSelectedKitchenCampus } from "@/lib/kitchen/use-selected-campus";

type Props = {
  schools: School[];
  defaultSchoolId: string;
  periods: Record<KitchenChecklistCadence, string>;
  templates: Record<KitchenChecklistCadence, KitchenChecklistTemplate[]>;
  initialEntries: KitchenChecklistEntry[];
  /** Drop the standalone page header when embedded inside another page's own section (e.g. the ops dashboard's Compliance tab). */
  embedded?: boolean;
};

const CADENCE_LABELS: Record<KitchenChecklistCadence, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

const CADENCE_HINTS: Record<KitchenChecklistCadence, string> = {
  daily: "Score 1-5 based on how the week's daily tasks went.",
  weekly: "Check off each item completed during this week's walkthrough.",
  monthly: "Check off each item completed during this month's deep clean.",
};

export function ChecklistClient({
  schools,
  defaultSchoolId,
  periods,
  templates,
  initialEntries,
  embedded = false,
}: Props) {
  // Embedded (desktop ops pages) shares the persisted "working campus" choice
  // across pages. Standalone (mobile /kitchen for cooks) always starts from
  // the signed-in cook's own profile campus instead -- not a cross-page
  // preference, so it never reads/writes the shared choice.
  const persistedCampus = useSelectedKitchenCampus(schools, defaultSchoolId);
  const localCampus = useState(defaultSchoolId);
  const [schoolId, setSchoolId] = embedded ? persistedCampus : localCampus;
  const [cadence, setCadence] = useState<KitchenChecklistCadence>("daily");
  const [entries, setEntries] = useState<KitchenChecklistEntry[]>(initialEntries);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setError(null);
    try {
      const periodDates = Array.from(new Set(Object.values(periods))).join(",");
      const res = await fetch(
        `/api/kitchen/checklist-entries?schoolId=${encodeURIComponent(schoolId)}&periodDates=${encodeURIComponent(periodDates)}`,
      );
      const data = (await res.json()) as { entries?: KitchenChecklistEntry[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to load checklist entries");
        return;
      }
      setEntries(data.entries ?? []);
    } catch {
      setError("Network error loading checklist entries");
    } finally {
      setLoading(false);
    }
  }, [schoolId, periods]);

  useEffect(() => {
    if (schoolId !== defaultSchoolId) void load();
  }, [schoolId, defaultSchoolId, load]);

  const entryByTemplateId = useMemo(() => {
    const map = new Map<string, KitchenChecklistEntry>();
    for (const e of entries) map.set(e.template_id, e);
    return map;
  }, [entries]);

  async function saveEntry(template: KitchenChecklistTemplate, scoreValue: number, comment: string) {
    setSavingId(template.id);
    setError(null);
    try {
      const res = await fetch("/api/kitchen/checklist-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: template.id,
          schoolId,
          periodDate: periods[template.cadence],
          scoreValue,
          comment,
        }),
      });
      const data = (await res.json()) as { entry?: KitchenChecklistEntry; error?: string };
      if (!res.ok || !data.entry) {
        setError(data.error ?? "Failed to save");
        return;
      }
      setEntries((prev) => [...prev.filter((e) => e.template_id !== template.id), data.entry!]);
    } catch {
      setError("Network error saving entry");
    } finally {
      setSavingId(null);
    }
  }

  const activeTemplates = templates[cadence];
  const completeness = checklistCompleteness(cadence, activeTemplates, entries);
  const scorePct = completeness.scorePct;

  return (
    <div
      className={
        embedded
          ? "ui-rise flex flex-col gap-5 rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)]"
          : "flex flex-col gap-5"
      }
    >
      <div>
        {embedded ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
              Compliance
            </p>
            <h2 className="mt-1 font-display text-lg font-bold text-ink">
              Log a checklist score
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              For scores collected on paper or verbally — not everything comes in through
              the cook app.
            </p>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-electric-blue">
              Kitchen
            </p>
            <h1 className="mt-1 text-2xl font-bold text-electric-blue">Checklists</h1>
          </>
        )}
        {schools.length > 1 ? (
          <label className="mt-3 flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Campus</span>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
            >
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="flex gap-2">
        {(Object.keys(CADENCE_LABELS) as KitchenChecklistCadence[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCadence(c)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              cadence === c ? "bg-electric-blue text-white" : "bg-white text-ink-muted"
            }`}
          >
            {CADENCE_LABELS[c]}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-[var(--radius)] border border-danger/30 bg-danger-15 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]">
        <p className="text-xs text-ink-muted">{CADENCE_HINTS[cadence]}</p>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-ink">
            {completeness.scoredCount}/{completeness.totalItems} items scored this period
          </span>
          <span
            className={`font-bold ${
              scorePct !== null && scorePct >= CHECKLIST_TARGET_PCT ? "text-success" : "text-danger"
            }`}
          >
            {scorePct !== null ? `${Math.round(scorePct * 100)}%` : "—"}
            <span className="ml-1 font-normal text-ink-faint">
              (target {Math.round(CHECKLIST_TARGET_PCT * 100)}%)
            </span>
          </span>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {activeTemplates.map((template) => (
            <ChecklistItem
              key={template.id}
              template={template}
              entry={entryByTemplateId.get(template.id)}
              saving={savingId === template.id}
              onSave={(score, comment) => void saveEntry(template, score, comment)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ChecklistItem({
  template,
  entry,
  saving,
  onSave,
}: {
  template: KitchenChecklistTemplate;
  entry: KitchenChecklistEntry | undefined;
  saving: boolean;
  onSave: (score: number, comment: string) => void;
}) {
  const [score, setScore] = useState(entry?.score_value ?? (template.cadence === "daily" ? 0 : 0));
  const [comment, setComment] = useState(entry?.comment ?? "");

  return (
    <li className="rounded-[var(--radius)] border border-card-border bg-card p-4 shadow-[var(--shadow)]">
      <p className="text-sm font-semibold text-ink">{template.item_text_en}</p>
      {template.item_text_sw ? (
        <p className="mt-0.5 text-xs text-ink-faint">{template.item_text_sw}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {template.cadence === "daily" ? (
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setScore(n)}
                className={`h-9 w-9 rounded-full text-sm font-bold ${
                  score === n ? "bg-electric-blue text-white" : "bg-light-blue-30 text-ink-muted"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        ) : (
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={score === 1}
              onChange={(e) => setScore(e.target.checked ? 1 : 0)}
              className="h-5 w-5"
            />
            Completed
          </label>
        )}
      </div>

      <input
        type="text"
        placeholder="Comment (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="mt-3 w-full rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-sm"
      />

      <button
        type="button"
        disabled={saving}
        onClick={() => onSave(score, comment)}
        className="mt-3 rounded-[var(--radius-sm)] bg-electric-blue px-4 py-1.5 text-xs font-semibold text-white hover:bg-navy-light disabled:opacity-60"
      >
        {saving ? "Saving…" : entry ? "Update" : "Save"}
      </button>
    </li>
  );
}
