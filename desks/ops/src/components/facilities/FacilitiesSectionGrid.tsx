import Link from "next/link";
import { FACILITIES_SECTIONS } from "@/lib/facilities-sections";

export function FacilitiesSectionGrid() {
  return (
    <section className="ui-rise">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
        Modules
      </p>
      <h2 className="mb-3 mt-1 font-display text-lg font-bold text-ink">Live trackers</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {FACILITIES_SECTIONS.map((section) => (
          <li key={section.id}>
            <Link
              href={section.href}
              className="flex h-full items-center justify-between gap-4 rounded-[var(--radius)] border border-card-border bg-card p-4 no-underline shadow-[var(--shadow)] transition hover:border-electric-blue/25 hover:shadow-[var(--shadow-lg)]"
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink">{section.name}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{section.blurb}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                  Live · was Excel {section.sheetTab.trim()}
                </p>
              </div>
              <span className="shrink-0 text-lg text-electric-blue">→</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-ink-faint">
        Not in the live app (historical Excel only): Summary index, Notes Work plan,
        Facilities Plan 2025, Calculation (Do Not Edit), Guard attendance (2025), and legacy
        2024 topsheets. Day-to-day ops data is on the Top Sheet + modules above.
      </p>
    </section>
  );
}
