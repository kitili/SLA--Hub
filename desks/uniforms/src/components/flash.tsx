"use client";

import { useEffect, useState } from "react";

const AUTO_DISMISS_MS = 6000;

export function Flash({ error, ok }: { error?: string | null; ok?: string | null }) {
  const message = error || ok;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
    // Errors stay up until someone dismisses them — a "you can't fulfill
    // this" message is actionable, not a passing confirmation, and the
    // person reading it may have a parent standing in front of them right
    // now. Only success messages auto-fade.
    if (!message || error) return;
    const timer = window.setTimeout(() => setDismissed(true), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [message, error]);

  if (!message || dismissed) return null;

  return (
    <p
      className={`mb-4 flex items-start justify-between gap-3 rounded-[10px] px-3 py-2 text-sm ${
        error ? "bg-danger-15 text-danger" : "bg-success-15 text-success"
      }`}
    >
      <span>{message}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="shrink-0 font-semibold opacity-70 hover:opacity-100"
      >
        ×
      </button>
    </p>
  );
}
