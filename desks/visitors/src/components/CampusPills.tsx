"use client";

import { CAMPUS_NAMES } from "@/domain/Campus";

export function CampusPills({
  value,
  onChange,
}: {
  value: string;
  onChange: (campus: string) => void;
}) {
  return (
    <div className="campus-row" role="tablist" aria-label="Campuses">
      {CAMPUS_NAMES.map((campus) => (
        <button
          key={campus}
          type="button"
          className={`campus-pill${campus === value ? " active" : ""}`}
          onClick={() => onChange(campus)}
        >
          {campus}
        </button>
      ))}
    </div>
  );
}
