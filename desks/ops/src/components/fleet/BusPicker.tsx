"use client";

import { useMemo, useState } from "react";
import { sortByAlpha } from "@/lib/sort/alphabetical";
import type { Bus } from "@/types/database";

export type BusPickerMeta = Record<string, string | null | undefined>;

type Props = {
  buses: Bus[];
  selectedBusId: string;
  onSelect: (busId: string) => void;
  /** Optional second line per bus, e.g. student counts */
  metaByBusId?: BusPickerMeta;
  title?: string;
  hint?: string;
  searchPlaceholder?: string;
  /** Keep list visible even when search is empty (default true). */
  alwaysShowList?: boolean;
  className?: string;
};

/**
 * Shared full-fleet bus picker for Driver + Matron home.
 * Scrollable list of every bus — no assignment / “usual bus” UI.
 */
export function BusPicker({
  buses,
  selectedBusId,
  onSelect,
  metaByBusId,
  title = "Choose your bus",
  hint = "Tap a bus from the list. Search to narrow it down.",
  searchPlaceholder = "Search name, plate, or driver…",
  alwaysShowList = true,
  className = "",
}: Props) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const sortedBuses = useMemo(
    () => sortByAlpha(buses, (b) => b.label),
    [buses],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedBuses;
    return sortedBuses.filter((b) => {
      const hay =
        `${b.label} ${b.plate_number ?? ""} ${b.driver_name ?? ""} ${b.attendant_name ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [sortedBuses, query]);

  const showList = alwaysShowList || focused || query.trim().length > 0;
  const selected = buses.find((b) => b.id === selectedBusId) ?? null;

  return (
    <section
      className={`rounded-2xl border-2 border-electric-blue/25 bg-white p-4 shadow-[0_8px_28px_rgba(0,35,104,0.1)] sm:p-5 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-electric-blue">
            Bus selection
          </p>
          <h2 className="mt-1 font-display text-xl font-bold text-electric-blue">
            {title}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{hint}</p>
        </div>
        <span className="shrink-0 rounded-full bg-electric-blue px-3 py-1 text-[11px] font-bold text-white">
          {buses.length} buses
        </span>
      </div>

      {buses.length === 0 ? (
        <p className="mt-4 rounded-xl bg-gold-15 px-3 py-3 text-sm text-ink">
          No buses loaded. Ask transport to check Admin → Buses.
        </p>
      ) : (
        <>
          <label className="mt-4 block">
            <span className="sr-only">Find your bus</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                // Keep list open; only clear focus highlight later
                window.setTimeout(() => setFocused(false), 150);
              }}
              placeholder={searchPlaceholder}
              autoComplete="off"
              className="w-full rounded-xl border-2 border-electric-blue/20 bg-[var(--app-bg,#f3f8fd)] px-3.5 py-3.5 text-base text-ink outline-none focus:border-electric-blue focus:ring-4 focus:ring-light-blue/35"
            />
          </label>

          {showList ? (
            <ul
              className="mt-3 max-h-[min(55vh,22rem)] space-y-1.5 overflow-y-auto overscroll-contain rounded-xl border border-card-border bg-[var(--app-bg,#f3f8fd)] p-1.5"
              role="listbox"
              aria-label="All buses"
            >
              {filtered.length === 0 ? (
                <li className="px-3 py-4 text-center text-sm text-ink-muted">
                  No buses match “{query.trim()}”.
                </li>
              ) : (
                filtered.map((bus) => {
                  const selectedRow = bus.id === selectedBusId;
                  const meta = metaByBusId?.[bus.id];
                  return (
                    <li key={bus.id} role="option" aria-selected={selectedRow}>
                      <button
                        type="button"
                        onClick={() => onSelect(bus.id)}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3.5 text-left transition ${
                          selectedRow
                            ? "bg-electric-blue text-white shadow-md"
                            : "bg-white text-ink hover:bg-light-blue-30"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">
                            {bus.label}
                          </span>
                          <span
                            className={`block truncate text-xs ${
                              selectedRow ? "text-white/75" : "text-ink-muted"
                            }`}
                          >
                            {[
                              bus.plate_number,
                              bus.driver_name
                                ? `Driver ${bus.driver_name}`
                                : null,
                              meta,
                              `${bus.capacity} seats`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        {selectedRow ? (
                          <span className="shrink-0 text-xs font-bold text-gold">
                            Selected
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          ) : null}

          {selected ? (
            <p className="mt-3 rounded-xl bg-light-blue-30/80 px-3 py-2.5 text-sm font-semibold text-electric-blue">
              Selected: {selected.label}
              {selected.plate_number ? ` · ${selected.plate_number}` : ""}
            </p>
          ) : (
            <p className="mt-3 text-sm font-semibold text-ink-muted">
              Scroll the list and tap your bus.
            </p>
          )}
        </>
      )}
    </section>
  );
}
