import Link from "next/link";
import { KITCHEN_SECTIONS } from "@/lib/kitchen-sections";

export function KitchenModulesGrid() {
  const modules = KITCHEN_SECTIONS.filter((s) => s.id !== "dashboard");

  return (
    <section className="ui-rise mt-6 rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">Modules</p>
      <h2 className="mt-1 font-display text-lg font-bold text-ink">
        2026 Kitchens Master Sheet — what maps where
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {modules.map((m) => (
          <Link
            key={m.id}
            href={m.href}
            className="flex flex-col gap-1 rounded-[var(--radius-sm)] border border-card-border bg-white/70 p-4 no-underline transition hover:bg-light-blue-30"
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-base font-bold text-ink">{m.name}</span>
              <span className="text-electric-blue">→</span>
            </div>
            <p className="text-sm text-ink-muted">{m.blurb}</p>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
              Excel · {m.sheetTab}
            </span>
          </Link>
        ))}
      </div>
      <p className="mt-4 text-xs text-ink-faint">
        Not built into the app: Menu matrices, TOTAL REQUIRED / DETAIL totals, and Budget
        Import (source formulas were broken — see Procurement for the live replacement).
      </p>
    </section>
  );
}
