"use client";

import { useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { ghostClass } from "./forms";

export function Btn({
  children,
  tone = "primary",
  type = "submit",
  name,
  value,
  onClick,
}: {
  children: ReactNode;
  tone?: "primary" | "ghost" | "danger";
  type?: "submit" | "button";
  name?: string;
  value?: string;
  onClick?: () => void;
}) {
  const cls =
    tone === "primary"
      ? "bg-electric-blue text-white shadow-md shadow-electric-blue/20 hover:bg-navy-light"
      : tone === "danger"
        ? "bg-danger text-white"
        : ghostClass();
  const { pending } = useFormStatus();
  const disabled = type === "submit" && pending;
  const lastClickAt = useRef(0);
  return (
    <button
      type={type}
      name={name}
      value={value}
      onClick={(e) => {
        // useFormStatus().pending only flips after React re-renders, which
        // leaves a real gap where a fast double-click fires two submits
        // before the button visually disables. Block a second click landing
        // in that gap by preventDefault-ing IT — never by disabling the DOM
        // node on the first click, which cancels that same click's own
        // native form submission in Chromium (confirmed live: it broke
        // every submit button in the app). The first click always goes
        // through untouched; only a repeat within the window is blocked.
        if (type === "submit") {
          const now = Date.now();
          if (now - lastClickAt.current < 800) {
            e.preventDefault();
            return;
          }
          lastClickAt.current = now;
        }
        onClick?.();
      }}
      disabled={disabled}
      aria-busy={disabled}
      className={`rounded-[10px] px-3.5 py-2 text-sm font-semibold ${cls} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {children}
    </button>
  );
}
