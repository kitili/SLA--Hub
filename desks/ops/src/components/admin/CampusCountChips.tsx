"use client";

import type { CampusCount } from "@/lib/dashboard/campus-count";

export function CampusCountChips({
  counts,
  selected,
  onSelect,
}: {
  counts: CampusCount[];
  selected: string | null;
  onSelect: (schoolId: string | null) => void;
}) {
  const total = counts.reduce((sum, c) => sum + c.count, 0);
  const most = counts[0];
  const fewest = counts[counts.length - 1];

  return (
    <div className="mt-4">
      <p className="text-sm text-ink-muted">
        {total === 0 || !most || !fewest ? (
          "No records yet."
        ) : (
          <>
            Most: <span className="font-semibold text-ink">{most.name}</span> ({most.count}) ·
            Fewest: <span className="font-semibold text-ink">{fewest.name}</span> ({fewest.count})
          </>
        )}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            selected === null
              ? "bg-electric-blue text-white"
              : "bg-light-blue-30 text-ink-muted"
          }`}
        >
          All campuses
        </button>
        {counts.map((c) => (
          <button
            key={c.schoolId}
            type="button"
            onClick={() => onSelect(selected === c.schoolId ? null : c.schoolId)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              selected === c.schoolId
                ? "bg-electric-blue text-white"
                : "bg-light-blue-30 text-ink-muted"
            }`}
          >
            {c.name} · {c.count}
          </button>
        ))}
      </div>
    </div>
  );
}
