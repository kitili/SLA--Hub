"use client";

import { useState } from "react";

type OtherStudent = {
  id: string;
  first_name: string;
  last_name: string;
};

type Props = {
  lat: number | null;
  lng: number | null;
  otherStudents: OtherStudent[];
};

export function StudentStopInfo({ lat, lng, otherStudents }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-electric-blue/15 bg-light-blue-30/70 px-2.5 py-1 text-xs font-semibold text-electric-blue transition hover:border-electric-blue/30 hover:bg-light-blue-30"
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-electric-blue"
          aria-hidden
        />
        Pickup point
        {otherStudents.length > 0 ? (
          <span className="text-ink-muted">+{otherStudents.length}</span>
        ) : null}
      </button>
      {open ? (
        <div className="ui-rise mt-2 rounded-[var(--radius-sm)] border border-card-border bg-white/80 px-3 py-2.5 text-xs text-ink-muted shadow-[var(--shadow)]">
          <p className="font-mono text-[11px] text-ink-faint">
            {lat != null && lng != null
              ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
              : "No coordinates yet"}
          </p>
          {otherStudents.length > 0 ? (
            <p className="mt-1.5 leading-relaxed">
              Shares stop with{" "}
              <span className="font-semibold text-ink">
                {otherStudents
                  .map((s) => `${s.first_name} ${s.last_name}`)
                  .join(", ")}
              </span>
            </p>
          ) : (
            <p className="mt-1.5">No other students at this stop.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
