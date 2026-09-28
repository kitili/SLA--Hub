"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { departmentForPath, DEPARTMENT_LABEL } from "@/lib/pilot-feedback/department";
import type { PilotFeedback } from "@/lib/db/pilot-feedback";

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
};

const STATUS_TONE: Record<string, string> = {
  open: "bg-danger-15 text-danger",
  in_progress: "bg-gold-15 text-ink-muted",
  done: "bg-success-15 text-success",
};

export function FeedbackWidget() {
  const pathname = usePathname() ?? "/";
  const department = departmentForPath(pathname);

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"new" | "mine">("new");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [mine, setMine] = useState<PilotFeedback[] | null>(null);
  const [loadingMine, setLoadingMine] = useState(false);

  useEffect(() => {
    if (!open || tab !== "mine" || mine !== null) return;
    setLoadingMine(true);
    fetch("/api/pilot-feedback?mine=1")
      .then((res) => res.json())
      .then((data: { feedback?: PilotFeedback[] }) => setMine(data.feedback ?? []))
      .catch(() => setMine([]))
      .finally(() => setLoadingMine(false));
  }, [open, tab, mine]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    if (!message.trim()) {
      setError("Say what needs fixing first");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/pilot-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department, pagePath: pathname, message: message.trim() }),
      });
      const data = (await res.json()) as { feedback?: PilotFeedback; error?: string };
      if (!res.ok || !data.feedback) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      setMessage("");
      setOkMsg("Your feedback has been sent.");
      setMine((prev) => (prev ? [data.feedback!, ...prev] : prev));
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close feedback" : "Give feedback"}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-electric-blue text-2xl font-bold text-white shadow-[0_8px_24px_rgba(0,35,104,0.35)] transition hover:scale-105 hover:bg-navy-light"
      >
        {open ? "×" : "+"}
      </button>

      {open ? (
        <div className="fixed bottom-24 right-5 z-50 flex w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-[var(--radius)] border border-card-border bg-card shadow-[var(--shadow-lg)]">
          <div className="flex items-center justify-between border-b border-card-border bg-light-blue-30 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-ink">Pilot feedback</p>
              <p className="text-xs text-ink-faint">{DEPARTMENT_LABEL[department] ?? department}</p>
            </div>
            <div className="flex gap-1 rounded-full bg-white/70 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTab("new")}
                className={`rounded-full px-2.5 py-1 ${tab === "new" ? "bg-electric-blue text-white" : "text-ink-muted"}`}
              >
                New
              </button>
              <button
                type="button"
                onClick={() => setTab("mine")}
                className={`rounded-full px-2.5 py-1 ${tab === "mine" ? "bg-electric-blue text-white" : "text-ink-muted"}`}
              >
                Mine
              </button>
            </div>
          </div>

          {tab === "new" ? (
            <form onSubmit={submit} className="flex flex-col gap-2 p-4">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What needs fixing or changing here?"
                rows={4}
                autoFocus
                className="rounded-(--radius-sm) border border-card-border px-3 py-2 text-sm text-ink"
              />
              {error ? <p className="text-xs font-semibold text-danger">{error}</p> : null}
              {okMsg ? <p className="text-xs font-semibold text-success">{okMsg}</p> : null}
              <button
                type="submit"
                disabled={saving}
                className="rounded-(--radius-sm) bg-electric-blue px-3 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
              >
                {saving ? "Sending…" : "Send"}
              </button>
            </form>
          ) : (
            <div className="max-h-80 overflow-y-auto p-3">
              {loadingMine ? (
                <p className="p-2 text-sm text-ink-muted">Loading…</p>
              ) : !mine || mine.length === 0 ? (
                <p className="p-2 text-sm text-ink-muted">You haven&apos;t sent any feedback yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {mine.map((f) => (
                    <li
                      key={f.id}
                      className="rounded-(--radius-sm) border border-card-border bg-white/60 p-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-ink-muted">
                          {DEPARTMENT_LABEL[f.department] ?? f.department}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 font-bold ${STATUS_TONE[f.status]}`}>
                          {STATUS_LABEL[f.status]}
                        </span>
                      </div>
                      <p className="mt-1 text-ink">{f.message}</p>
                      <p className="mt-1 text-ink-faint">{new Date(f.created_at).toLocaleString()}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
