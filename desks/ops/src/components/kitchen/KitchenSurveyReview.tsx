"use client";

import { useCallback, useEffect, useState } from "react";
import type { School } from "@/types/database";
import type {
  KitchenConsistencyRating,
  KitchenQualityRating,
  KitchenSatisfactionLevel,
  KitchenSurveyResponse,
  KitchenSurveySource,
} from "@/lib/db/kitchen";

const QUALITY_LABELS: Record<string, string> = {
  poor: "Poor",
  fair: "Fair",
  good: "Good",
  excellent: "Excellent",
};

const SOURCE_LABELS: Record<KitchenSurveySource, string> = {
  learner_survey: "Live form",
  food_quality_tracker: "Phone / paper / in person",
};

const SATISFACTION_LABELS: Record<string, string> = {
  most_satisfied: "Most students satisfied",
  some_not_satisfied: "Some students not satisfied",
  many_not_satisfied: "Many students not satisfied",
};

export function KitchenSurveyReview({ schools }: { schools: School[] }) {
  const [schoolId, setSchoolId] = useState("");
  const [responses, setResponses] = useState<KitchenSurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [formSchoolId, setFormSchoolId] = useState(schools[0]?.id ?? "");
  const [classOrGrade, setClassOrGrade] = useState("");
  const [source, setSource] = useState<KitchenSurveySource>("learner_survey");
  const [qualityRating, setQualityRating] = useState<KitchenQualityRating | "">("");
  const [servedOnTime, setServedOnTime] = useState<"" | "yes" | "no">("");
  const [sufficientQuantity, setSufficientQuantity] = useState<"" | "yes" | "no">("");
  const [consistencyRating, setConsistencyRating] = useState<KitchenConsistencyRating | "">("");
  const [satisfactionLevel, setSatisfactionLevel] = useState<KitchenSatisfactionLevel | "">("");
  const [commentText, setCommentText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = schoolId ? `?schoolId=${encodeURIComponent(schoolId)}` : "";
      const res = await fetch(`/api/kitchen/survey-responses${qs}`);
      const data = (await res.json()) as { responses?: KitchenSurveyResponse[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to load survey responses");
        return;
      }
      setResponses(data.responses ?? []);
    } catch {
      setError("Network error loading survey responses");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function removeResponse(id: string) {
    const prev = responses;
    setResponses((r) => r.filter((x) => x.id !== id));
    const res = await fetch(`/api/kitchen/survey-responses/${id}`, { method: "DELETE" });
    if (!res.ok) setResponses(prev);
  }

  async function submitSurvey(e: React.FormEvent) {
    e.preventDefault();
    if (!qualityRating) {
      setError("Pick a quality rating");
      return;
    }
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/kitchen/survey-responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          schoolId: formSchoolId || null,
          classOrGrade: classOrGrade.trim() || null,
          qualityRating,
          servedOnTime: servedOnTime === "" ? null : servedOnTime === "yes",
          sufficientQuantity:
            sufficientQuantity === "" ? null : sufficientQuantity === "yes",
          consistencyRating: consistencyRating || null,
          satisfactionLevel: satisfactionLevel || null,
          commentText: commentText.trim() || null,
        }),
      });
      const data = (await res.json()) as {
        response?: KitchenSurveyResponse;
        error?: string;
      };
      if (!res.ok || !data.response) {
        setError(data.error ?? "Failed to save survey");
        return;
      }
      setOkMsg("Survey saved to the live Kitchen sheet");
      setClassOrGrade("");
      setQualityRating("");
      setServedOnTime("");
      setSufficientQuantity("");
      setConsistencyRating("");
      setSatisfactionLevel("");
      setCommentText("");
      await load();
    } catch {
      setError("Network error saving survey");
    } finally {
      setSaving(false);
    }
  }

  const qualityCounts = responses.reduce<Record<string, number>>((acc, r) => {
    if (r.quality_rating) acc[r.quality_rating] = (acc[r.quality_rating] ?? 0) + 1;
    return acc;
  }, {});
  const totalRated = Object.values(qualityCounts).reduce((a, b) => a + b, 0);

  return (
    <section className="ui-rise rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
        Food quality · live sheet
      </p>
      <h2 className="mt-1 font-display text-lg font-bold text-ink">
        Satisfaction surveys
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Enter responses here. Historic Food Quality Tracker rows were imported once;
        new surveys live only in Ops.
      </p>

      <form
        onSubmit={submitSurvey}
        className="mt-4 grid gap-3 rounded-[var(--radius-sm)] border border-card-border bg-white/70 p-3 sm:grid-cols-2"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Campus</span>
          <select
            value={formSchoolId}
            onChange={(e) => setFormSchoolId(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
          >
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Class / grade</span>
          <input
            value={classOrGrade}
            onChange={(e) => setClassOrGrade(e.target.value)}
            placeholder="e.g. Grade 4B"
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Source</span>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as KitchenSurveySource)}
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
          >
            {(Object.keys(SOURCE_LABELS) as KitchenSurveySource[]).map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Food quality</span>
          <select
            required
            value={qualityRating}
            onChange={(e) => setQualityRating(e.target.value as KitchenQualityRating | "")}
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
          >
            <option value="">Select…</option>
            {Object.entries(QUALITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Satisfaction</span>
          <select
            value={satisfactionLevel}
            onChange={(e) =>
              setSatisfactionLevel(e.target.value as KitchenSatisfactionLevel | "")
            }
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
          >
            <option value="">Select…</option>
            {Object.entries(SATISFACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Served on time?</span>
          <select
            value={servedOnTime}
            onChange={(e) => setServedOnTime(e.target.value as "" | "yes" | "no")}
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
          >
            <option value="">—</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-ink">Enough quantity?</span>
          <select
            value={sufficientQuantity}
            onChange={(e) => setSufficientQuantity(e.target.value as "" | "yes" | "no")}
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
          >
            <option value="">—</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-semibold text-ink">Consistency</span>
          <select
            value={consistencyRating}
            onChange={(e) =>
              setConsistencyRating(e.target.value as KitchenConsistencyRating | "")
            }
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
          >
            <option value="">—</option>
            <option value="very_consistent">Very consistent</option>
            <option value="somewhat_consistent">Somewhat consistent</option>
            <option value="not_consistent">Not consistent</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-semibold text-ink">Comments</span>
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={2}
            className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save survey response"}
          </button>
          {okMsg ? <p className="mt-2 text-sm text-success">{okMsg}</p> : null}
        </div>
      </form>

      <label className="mt-5 flex max-w-xs flex-col gap-1 text-sm">
        <span className="font-semibold text-ink">Filter campus</span>
        <select
          value={schoolId}
          onChange={(e) => setSchoolId(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-card-border px-3 py-2 text-ink"
        >
          <option value="">All campuses</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      {loading ? (
        <p className="mt-3 text-sm text-ink-muted">Loading…</p>
      ) : responses.length === 0 ? (
        <p className="mt-4 rounded-[var(--radius-sm)] border border-dashed border-card-border bg-white/60 px-4 py-6 text-center text-sm text-ink-muted">
          No survey responses yet — use the form above.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(qualityCounts).map(([rating, count]) => (
              <span
                key={rating}
                className="rounded-full bg-light-blue-30 px-3 py-1 text-xs font-semibold text-ink-muted"
              >
                {QUALITY_LABELS[rating] ?? rating}: {count}
                {totalRated ? ` (${Math.round((count / totalRated) * 100)}%)` : ""}
              </span>
            ))}
          </div>

          <ul className="mt-4 flex max-h-96 flex-col gap-3 overflow-y-auto">
            {responses.map((r) => (
              <li
                key={r.id}
                className="rounded-[var(--radius-sm)] border border-card-border p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                  <span>{new Date(r.submitted_at).toLocaleDateString()}</span>
                  {r.class_or_grade ? <span>· {r.class_or_grade}</span> : null}
                  {r.quality_rating ? (
                    <span className="font-semibold text-electric-blue">
                      {QUALITY_LABELS[r.quality_rating]}
                    </span>
                  ) : null}
                  {r.satisfaction_level ? (
                    <span>{SATISFACTION_LABELS[r.satisfaction_level]}</span>
                  ) : null}
                  <span className="rounded-full bg-success-15 px-2 py-0.5 text-[10px] font-bold uppercase text-success">
                    {SOURCE_LABELS[r.source]}
                  </span>
                  <button
                    type="button"
                    onClick={() => void removeResponse(r.id)}
                    className="ml-auto text-xs font-semibold text-danger hover:underline"
                  >
                    Remove
                  </button>
                </div>
                {r.comment_text ? <p className="mt-1 text-ink">{r.comment_text}</p> : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
