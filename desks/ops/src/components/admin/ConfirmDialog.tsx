"use client";

import { useCallback, useRef, useState } from "react";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for delete/deactivate-style actions vs. the default
   * blue for create/save actions. */
  tone?: "default" | "danger";
};

type PendingConfirm = ConfirmOptions & { resolve: (value: boolean) => void };

/**
 * Renders a confirm dialog on demand and returns an async confirm() function.
 * Usage: const { confirm, dialog } = useConfirm(); ... render {dialog} once in
 * the component tree, then `if (!(await confirm({ message: "..." }))) return;`
 * before any create/update/delete call.
 */
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  // Guards against the same promise being resolved twice (e.g. a fast
  // double-click on Confirm before the dialog unmounts).
  const settled = useRef(false);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      settled.current = false;
      setPending({ ...options, resolve });
    });
  }, []);

  function settle(value: boolean) {
    if (settled.current || !pending) return;
    settled.current = true;
    pending.resolve(value);
    setPending(null);
  }

  const dialog = pending ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={pending.title ?? "Confirm"}
      onClick={() => settle(false)}
    >
      <div
        className="w-full max-w-sm rounded-[var(--radius)] border border-card-border bg-card p-6 shadow-[var(--shadow)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-ink">{pending.title ?? "Are you sure?"}</h2>
        <p className="mt-2 text-sm text-ink-muted">{pending.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => settle(false)}
            className="rounded-[var(--radius-sm)] border border-card-border px-4 py-2 text-sm font-semibold text-ink-muted hover:border-ink-muted"
          >
            {pending.cancelLabel ?? "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => settle(true)}
            autoFocus
            className={
              pending.tone === "danger"
                ? "rounded-[var(--radius-sm)] bg-danger px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                : "rounded-[var(--radius-sm)] bg-electric-blue px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
            }
          >
            {pending.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
