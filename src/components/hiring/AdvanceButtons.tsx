"use client";

import { Link, useRouter } from "@/i18n/navigation";
import { useEffect, useState } from "react";

import type { Candidate, PipelineAction } from "@/lib/hiring/types";
import {
  CULTURE_COMPLETE_STAGES,
  ONLINE_INTERVIEW_STAGES,
  PERFORMANCE_COMPLETE_STAGES,
} from "@/lib/hiring/types";

import styles from "./hiring.module.css";

type PerformanceTaskOption = {
  id: string;
  title: string;
  isActive: boolean;
};

export function AdvanceButtons({
  candidate,
  compact = false,
}: {
  candidate: Candidate;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<PipelineAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  // Online interview form state
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewStart, setInterviewStart] = useState("");
  const [interviewEnd, setInterviewEnd] = useState("");
  const [interviewers, setInterviewers] = useState("");

  // In-person interview form state
  const [showInPersonForm, setShowInPersonForm] = useState(false);
  const [inPersonDate, setInPersonDate] = useState("");
  const [inPersonStart, setInPersonStart] = useState("");
  const [inPersonLocation, setInPersonLocation] = useState("");
  const [inPersonInterviewers, setInPersonInterviewers] = useState("");

  // Performance task form state
  const [showPerformanceForm, setShowPerformanceForm] = useState(false);
  const [performanceTasks, setPerformanceTasks] = useState<
    PerformanceTaskOption[]
  >([]);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [tasksLoading, setTasksLoading] = useState(false);
  const [deptEmails, setDeptEmails] = useState<{ label: string; email: string }[]>([]);
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!compact) {
      setTasksLoading(true);
      Promise.all([
        fetch("/api/hiring/performance-tasks").then((r) => r.json()),
        fetch("/api/admin/settings?key=performance_dept_emails").then((r) => r.json()),
      ])
        .then(([tasksData, settingData]: [unknown, unknown]) => {
          if (Array.isArray(tasksData)) {
            const active = (tasksData as PerformanceTaskOption[]).filter(
              (t) => t.isActive,
            );
            setPerformanceTasks(active);
            const first = active[0];
            if (first) setSelectedTaskId(first.id);
          }
          const raw = (settingData as { value?: string })?.value ?? "";
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              setDeptEmails(parsed as { label: string; email: string }[]);
            }
          } catch { /* no dept emails configured */ }
        })
        .catch(() => {})
        .finally(() => setTasksLoading(false));
    }
  }, [compact]);

  const isTerminal =
    candidate.stage === "hired" || candidate.stage === "rejected";

  async function advance(
    action: PipelineAction,
    extra?: Record<string, string>,
  ) {
    setBusy(action);
    setMessage(null);
    setIsError(false);
    const res = await fetch(`/api/hiring/candidates/${candidate.id}/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);

    if (!res.ok) {
      setIsError(true);
      setMessage(json.error || "Advance failed");
      return;
    }

    setIsError(false);
    setMessage(
      json.emailStubbed
        ? `Sent (${action}) — email stubbed (no SMTP)`
        : `Sent (${action})`,
    );
    setShowInterviewForm(false);
    setShowInPersonForm(false);
    setShowPerformanceForm(false);
    router.refresh();
  }

  async function submitInterviewForm(e: React.FormEvent) {
    e.preventDefault();
    if (!interviewDate || !interviewStart || !interviewEnd) return;
    await advance("online_interview", {
      interviewDate,
      interviewStart,
      interviewEnd,
      interviewers,
    });
  }

  async function submitInPersonForm(e: React.FormEvent) {
    e.preventDefault();
    if (!inPersonDate || !inPersonStart || !inPersonLocation) return;
    await advance("in_person", {
      interviewDate: inPersonDate,
      interviewStart: inPersonStart,
      interviewLocation: inPersonLocation,
      interviewers: inPersonInterviewers,
    });
  }

  async function submitPerformanceForm(e: React.FormEvent) {
    e.preventDefault();
    const extra: Record<string, string> = {};
    if (selectedTaskId) extra.taskId = selectedTaskId;
    if (selectedDepts.size > 0) extra.reviewDepts = [...selectedDepts].join(",");
    await advance("performance", extra);
  }

  function toggleDept(email: string) {
    setSelectedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email); else next.add(email);
      return next;
    });
  }

  if (isTerminal) return null;

  const cultureDisabled = candidate.culture_marker === "SENT" || busy !== null;
  const performanceDisabled =
    candidate.performance_marker === "SENT" ||
    busy !== null ||
    !CULTURE_COMPLETE_STAGES.includes(candidate.stage);
  const onlineDisabled =
    busy !== null || !PERFORMANCE_COMPLETE_STAGES.includes(candidate.stage);
  const inPersonDisabled =
    busy !== null || !ONLINE_INTERVIEW_STAGES.includes(candidate.stage);

  function openInPersonForm() {
    setShowInPersonForm((v) => !v);
    setShowInterviewForm(false);
    setShowPerformanceForm(false);
    setMessage(null);
  }

  function openPerformanceForm() {
    setShowPerformanceForm((v) => !v);
    setShowInterviewForm(false);
    setShowInPersonForm(false);
    setMessage(null);
  }

  function openOnlineInterviewForm() {
    setShowInterviewForm((v) => !v);
    setShowInPersonForm(false);
    setShowPerformanceForm(false);
    setMessage(null);
  }

  return (
    <div className={compact ? styles.advanceCompact : styles.advance}>
      <div className={styles.advanceButtons}>
        <button
          type="button"
          disabled={cultureDisabled}
          onClick={() => advance("culture")}
          className={styles.advanceCulture}
          title="Move Onto Culture Video"
        >
          {busy === "culture" ? "…" : "NEXT · Culture"}
        </button>
        <button
          type="button"
          disabled={performanceDisabled}
          onClick={() => {
            if (compact) {
              advance("performance");
            } else {
              openPerformanceForm();
            }
          }}
          className={styles.advancePerformance}
          title={
            performanceDisabled &&
            !CULTURE_COMPLETE_STAGES.includes(candidate.stage)
              ? "Requires culture video submission first"
              : "Move Onto Performance Task"
          }
        >
          {busy === "performance" ? "…" : "NEXT · Performance"}
        </button>
        {!compact ? (
          <>
            <button
              type="button"
              disabled={onlineDisabled}
              onClick={openOnlineInterviewForm}
              className={styles.advanceInterview}
              title={
                onlineDisabled
                  ? "Requires performance task submission first"
                  : "Schedule online interview"
              }
            >
              {busy === "online_interview" ? "…" : "NEXT · Online interview"}
            </button>
            <button
              type="button"
              disabled={inPersonDisabled}
              onClick={openInPersonForm}
              className={styles.advanceInterview}
              title={
                inPersonDisabled
                  ? "Requires online interview stage first"
                  : "Request in-person interview"
              }
            >
              {busy === "in_person" ? "…" : "NEXT · In-person"}
            </button>
          </>
        ) : null}
      </div>

      {showInterviewForm && !compact ? (
        <form onSubmit={submitInterviewForm} className={styles.interviewForm}>
          <p className={styles.interviewFormTitle}>
            Schedule online interview — a Google Meet link will be created and
            emailed to the candidate.
          </p>
          <label className={styles.interviewField}>
            <span>Date</span>
            <input
              type="date"
              required
              value={interviewDate}
              onChange={(e) => setInterviewDate(e.target.value)}
              className={styles.interviewInput}
            />
          </label>
          <label className={styles.interviewField}>
            <span>Start time (EAT)</span>
            <input
              type="time"
              required
              value={interviewStart}
              onChange={(e) => setInterviewStart(e.target.value)}
              className={styles.interviewInput}
            />
          </label>
          <label className={styles.interviewField}>
            <span>End time (EAT)</span>
            <input
              type="time"
              required
              value={interviewEnd}
              onChange={(e) => setInterviewEnd(e.target.value)}
              className={styles.interviewInput}
            />
          </label>
          <label className={styles.interviewField}>
            <span>Additional interviewers (optional, comma-separated)</span>
            <input
              type="text"
              placeholder="e.g. hr@silverleaf.co.tz, principal@silverleaf.co.tz"
              value={interviewers}
              onChange={(e) => setInterviewers(e.target.value)}
              className={styles.interviewInput}
            />
          </label>
          <div className={styles.interviewFormActions}>
            <button
              type="submit"
              disabled={busy === "online_interview"}
              className={styles.advanceCulture}
            >
              {busy === "online_interview" ? "Creating…" : "Confirm & send invite"}
            </button>
            <button
              type="button"
              onClick={() => setShowInterviewForm(false)}
              className={styles.interviewCancel}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {showInPersonForm && !compact ? (
        <form onSubmit={submitInPersonForm} className={styles.interviewForm}>
          <p className={styles.interviewFormTitle}>
            Schedule in-person interview — details will be emailed to the
            candidate.
          </p>
          <label className={styles.interviewField}>
            <span>Date</span>
            <input
              type="date"
              required
              value={inPersonDate}
              onChange={(e) => setInPersonDate(e.target.value)}
              className={styles.interviewInput}
            />
          </label>
          <label className={styles.interviewField}>
            <span>Start time (EAT)</span>
            <input
              type="time"
              required
              value={inPersonStart}
              onChange={(e) => setInPersonStart(e.target.value)}
              className={styles.interviewInput}
            />
          </label>
          <label className={styles.interviewField}>
            <span>Location</span>
            <textarea
              required
              placeholder="e.g. Silverleaf Academy DOS Campus, Ground Floor"
              value={inPersonLocation}
              onChange={(e) => setInPersonLocation(e.target.value)}
              className={styles.interviewInput}
              rows={2}
            />
          </label>
          <label className={styles.interviewField}>
            <span>Additional interviewers (optional, comma-separated emails)</span>
            <input
              type="text"
              placeholder="e.g. hr@silverleaf.co.tz, principal@silverleaf.co.tz"
              value={inPersonInterviewers}
              onChange={(e) => setInPersonInterviewers(e.target.value)}
              className={styles.interviewInput}
            />
          </label>
          <div className={styles.interviewFormActions}>
            <button
              type="submit"
              disabled={busy === "in_person"}
              className={styles.advanceCulture}
            >
              {busy === "in_person" ? "Sending…" : "Confirm & send invite"}
            </button>
            <button
              type="button"
              onClick={() => setShowInPersonForm(false)}
              className={styles.interviewCancel}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {showPerformanceForm && !compact ? (
        <form onSubmit={submitPerformanceForm} className={styles.interviewForm}>
          <p className={styles.interviewFormTitle}>
            Select a performance task to send to the candidate.
          </p>
          {tasksLoading ? (
            <p className={styles.interviewFormTitle}>Loading tasks…</p>
          ) : performanceTasks.length === 0 ? (
            <p className={styles.interviewFormTitle}>
              No tasks configured.{" "}
              <Link
                href="/admin/hiring/performance-tasks"
                className={styles.advanceLink}
              >
                Set one up in Performance Tasks.
              </Link>
            </p>
          ) : (
            <label className={styles.interviewField}>
              <span>Performance task</span>
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className={styles.interviewInput}
                required
              >
                {performanceTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {deptEmails.length > 0 ? (
            <div style={{ marginTop: "0.5rem" }}>
              <p className={styles.interviewFormTitle} style={{ marginBottom: "0.35rem" }}>
                Notify department HOD(s) on submission — HR is always notified:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {deptEmails.map((dept) => (
                  <label
                    key={dept.email}
                    style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.88rem", cursor: "pointer" }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedDepts.has(dept.email)}
                      onChange={() => toggleDept(dept.email)}
                    />
                    <span>
                      <strong>{dept.label}</strong>{" "}
                      <span style={{ color: "#64748b" }}>({dept.email})</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <div className={styles.interviewFormActions}>
            <button
              type="submit"
              disabled={
                busy === "performance" ||
                (!tasksLoading && performanceTasks.length === 0)
              }
              className={styles.advancePerformance}
            >
              {busy === "performance" ? "Sending…" : "Send task"}
            </button>
            <button
              type="button"
              onClick={() => setShowPerformanceForm(false)}
              className={styles.interviewCancel}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {message ? (
        <p className={isError ? styles.advanceError : styles.advanceOk}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
