"use client";

import { useRouter } from "@/i18n/navigation";
import { FormEvent, useState } from "react";

import type { Candidate } from "@/lib/hiring/types";

import styles from "./hiring.module.css";

const RESTART_OPTIONS: { value: string; label: string }[] = [
  { value: "new", label: "Fresh start — back to New (clears all pipeline progress)" },
  { value: "culture_video_submitted", label: "After culture video — ready to send performance task" },
  { value: "performance_task_submitted", label: "After performance task — ready for interview" },
  { value: "online_interview_requested", label: "After online interview — ready for in-person" },
];

export function CandidateManagePanel({ candidate }: { candidate: Candidate }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [restartStage, setRestartStage] = useState("new");

  const isIncomplete = candidate.stage === "incomplete_application";
  const isTerminal =
    candidate.stage === "hired" || candidate.stage === "rejected";
  const isRejected = candidate.stage === "rejected";

  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy("save");
    setError(null);
    setMessage(null);

    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/hiring/candidates/${candidate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notes: form.get("notes") || "",
        linkedin: form.get("linkedin") || "",
        cvLink: form.get("cvLink") || "",
        performanceTaskLink: form.get("performanceTaskLink") || "",
        cultureVideoFeedback: form.get("cultureVideoFeedback") || "",
        clearCultureMarker: form.get("clearCultureMarker") === "on",
        clearPerformanceMarker: form.get("clearPerformanceMarker") === "on",
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);

    if (!res.ok) {
      setError(json.error || "Save failed");
      return;
    }

    if (json.advanced) {
      setMessage(
        json.emailStubbed
          ? "Application complete — culture email stubbed (no SMTP)."
          : "Application complete — culture email sent.",
      );
    } else if (isIncomplete) {
      setMessage(
        `Saved. Still incomplete: ${json.candidate?.application_check || candidate.application_check}`,
      );
    } else {
      setMessage("Saved.");
    }
    router.refresh();
  }

  async function setOutcome(outcome: "hired" | "rejected") {
    if (!confirm(`Mark this candidate as ${outcome}?`)) return;

    setBusy(outcome);
    setError(null);
    setMessage(null);

    const res = await fetch(
      `/api/hiring/candidates/${candidate.id}/outcome`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      },
    );
    const json = await res.json().catch(() => ({}));
    setBusy(null);

    if (!res.ok) {
      setError(json.error || "Update failed");
      return;
    }

    if (outcome === "hired" && json.staffProvisioned) {
      setMessage(
        json.emailStubbed
          ? "Marked hired — onboarding record created; outcome email stubbed (no SMTP)."
          : "Marked hired — onboarding record created and candidate notified by email.",
      );
    } else if (json.emailStubbed) {
      setMessage(`Marked as ${outcome} — email stubbed (no SMTP).`);
    } else {
      setMessage(`Marked as ${outcome}.`);
    }
    router.refresh();
  }

  async function restartJourney() {
    const label = RESTART_OPTIONS.find((o) => o.value === restartStage)?.label ?? restartStage;
    if (!confirm(`Restart this candidate's journey?\n\n${label}\n\nThis will put them back in the active pipeline.`)) return;
    setBusy("restart");
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/hiring/candidates/${candidate.id}/restart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: restartStage }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(json.error || "Restart failed");
      return;
    }
    setMessage("Journey restarted — candidate is back in the active pipeline.");
    router.refresh();
  }

  return (
    <div className={styles.manageStack}>
      <section className={styles.manageSection}>
        <h3 className={styles.manageTitle}>
          {isIncomplete ? "Complete application" : "Edit candidate"}
        </h3>
        {isIncomplete ? (
          <p className={styles.muted}>
            Current check: <strong>{candidate.application_check}</strong>. Add
            LinkedIn and CV below — saving will send the culture email when both
            are present.
          </p>
        ) : null}
        <form onSubmit={saveEdit} className={styles.form}>
          {!isIncomplete ? (
            <label className={styles.field}>
              <span className={styles.label}>HR notes</span>
              <textarea
                name="notes"
                rows={3}
                defaultValue={candidate.notes || ""}
                className={styles.input}
              />
            </label>
          ) : null}
          <label className={styles.field}>
            <span className={styles.label}>LinkedIn</span>
            <input
              name="linkedin"
              defaultValue={candidate.linkedin || ""}
              className={styles.input}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>CV link</span>
            <input
              name="cvLink"
              defaultValue={candidate.cv_link || ""}
              className={styles.input}
            />
          </label>
          {!isIncomplete ? (
            <>
              <label className={styles.field}>
                <span className={styles.label}>Performance task link</span>
                <input
                  name="performanceTaskLink"
                  defaultValue={candidate.performance_task_link || ""}
                  className={styles.input}
                  placeholder="Overrides DEFAULT_PERFORMANCE_TASK_LINK"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Culture video feedback</span>
                <textarea
                  name="cultureVideoFeedback"
                  rows={2}
                  defaultValue={candidate.culture_video_feedback || ""}
                  className={styles.input}
                />
              </label>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  name="clearCultureMarker"
                  defaultChecked={false}
                />
                Clear culture SENT marker (allows re-send)
              </label>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  name="clearPerformanceMarker"
                  defaultChecked={false}
                />
                Clear performance SENT marker (allows re-send)
              </label>
            </>
          ) : (
            <input type="hidden" name="notes" value={candidate.notes || ""} />
          )}
          <button type="submit" disabled={busy !== null} className={styles.submit}>
            {busy === "save"
              ? "Saving…"
              : isIncomplete
                ? "Save & send culture email"
                : "Save changes"}
          </button>
        </form>
      </section>

      {!isTerminal ? (
        <section className={styles.manageSection}>
          <h3 className={styles.manageTitle}>Outcome</h3>
          <div className={styles.outcomeButtons}>
            <button
              type="button"
              disabled={busy !== null}
              className={styles.outcomeHired}
              onClick={() => setOutcome("hired")}
            >
              {busy === "hired" ? "…" : "Mark hired"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              className={styles.outcomeRejected}
              onClick={() => setOutcome("rejected")}
            >
              {busy === "rejected" ? "…" : "Mark rejected"}
            </button>
          </div>
          <p className={styles.muted}>
            Marking hired creates a staff onboarding record. Once their ed-admin
            account exists, they can sign in at the site home page and appear in{" "}
            <strong>Onboarding hub → Members</strong>.
          </p>
        </section>
      ) : null}

      {isRejected ? (
        <section className={styles.manageSection}>
          <h3 className={styles.manageTitle}>Restart journey</h3>
          <p className={styles.muted}>
            If HR wants to give this candidate another chance, choose where in the
            pipeline to bring them back to.
          </p>
          <div className={styles.field} style={{ marginBottom: "0.75rem" }}>
            <select
              value={restartStage}
              onChange={(e) => setRestartStage(e.target.value)}
              className={styles.input}
              disabled={busy !== null}
            >
              {RESTART_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={busy !== null}
            onClick={restartJourney}
            className={styles.submit}
            style={{ background: "#1e3a5f" }}
          >
            {busy === "restart" ? "Restarting…" : "Restart journey"}
          </button>
        </section>
      ) : null}

      {message ? <p className={styles.advanceOk}>{message}</p> : null}
      {error ? <p className={styles.advanceError}>{error}</p> : null}
    </div>
  );
}
