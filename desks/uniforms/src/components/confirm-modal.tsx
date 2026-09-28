"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Btn, ghostClass } from "./forms";

// A successful (non-redirecting) server action just revalidates and returns —
// there's no navigation to incidentally remount this modal closed anymore, so
// without this it stays open/stuck after a real save. Watches this form's own
// pending state and closes the modal the moment a submission finishes.
function AutoCloseOnSuccess({ onDone }: { onDone: () => void }) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) onDone();
    wasPending.current = pending;
  }, [pending, onDone]);
  return null;
}

/**
 * Self-contained confirm-before-you-commit pattern: a trigger button opens a
 * dialog with its own inner <form>, so the real submit button (rendered
 * inside that form) still gets useFormStatus's pending-disable behavior from
 * Btn. Nothing fires until the user hits the second, explicit confirm button.
 *
 * `children` is for bigger edit forms (e.g. a LinesEditor) that need more
 * than a plain confirm message — rendered above the hidden fields, inside
 * the same inner form, so it's part of what gets submitted.
 */
export function ConfirmModal({
  triggerLabel,
  triggerTone = "ghost",
  title,
  description,
  confirmLabel = "Yes, continue",
  tone = "danger",
  action,
  hiddenFields = {},
  children,
  wide = false,
}: {
  triggerLabel: string;
  triggerTone?: "primary" | "ghost" | "danger";
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: "primary" | "ghost" | "danger";
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields?: Record<string, string>;
  children?: ReactNode;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Btn type="button" tone={triggerTone} onClick={() => setOpen(true)}>
        {triggerLabel}
      </Btn>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          {/* Dynamic content (e.g. a long line-editor or SKU table in
              `children`) can grow taller than the viewport — without a scroll
              boundary here, the confirm/cancel buttons end up permanently
              off-screen with no way to reach them. */}
          <div className={`w-full ${wide ? "max-w-lg" : "max-w-sm"} max-h-[85vh] overflow-y-auto rounded-[14px] border border-card-border bg-white p-5 shadow-lg`}>
            <h2 className="font-display text-lg font-bold text-electric-blue">{title}</h2>
            <p className="mt-2 text-sm text-ink-muted">{description}</p>
            <form action={action} className="mt-4 grid gap-3">
              <AutoCloseOnSuccess onDone={() => setOpen(false)} />
              {children}
              {Object.entries(hiddenFields).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <div className="flex justify-end gap-2">
                <button type="button" className={ghostClass()} onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <Btn type="submit" tone={tone}>
                  {confirmLabel}
                </Btn>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
