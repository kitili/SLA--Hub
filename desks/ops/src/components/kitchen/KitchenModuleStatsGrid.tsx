import Link from "next/link";

type StatRow = {
  label: string;
  count: number;
  href: string;
};

export function KitchenModuleStatsGrid({ counts }: { counts: Record<string, number> }) {
  const rows: StatRow[] = [
    { label: "Ingredients", count: counts.kitchen_ingredients ?? 0, href: "/ops/kitchen" },
    { label: "Headcount lines", count: counts.kitchen_headcount_lines ?? 0, href: "/ops/kitchen" },
    { label: "Purchases logged", count: counts.kitchen_purchases ?? 0, href: "/ops/kitchen" },
    {
      label: "Campus ratio overrides",
      count: counts.kitchen_ingredient_campus_settings ?? 0,
      href: "/ops/kitchen",
    },
    { label: "Price records", count: counts.kitchen_ingredient_prices ?? 0, href: "/ops/kitchen" },
    {
      label: "Checklist items (seeded)",
      count: counts.kitchen_checklist_templates ?? 0,
      href: "/ops/kitchen/compliance",
    },
    { label: "SOP tasks", count: counts.kitchen_sop_tasks ?? 0, href: "/ops/kitchen/compliance" },
    {
      label: "Survey responses",
      count: counts.kitchen_survey_responses ?? 0,
      href: "/ops/kitchen/surveys",
    },
  ];

  return (
    <section className="ui-rise mt-6 rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
        Live counts
      </p>
      <h2 className="mt-1 font-display text-lg font-bold text-ink">Data behind this module</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((row) => (
          <Link
            key={row.label}
            href={row.href}
            className="flex items-center justify-between rounded-[var(--radius-sm)] border border-card-border bg-white/70 px-3 py-2.5 no-underline transition hover:bg-light-blue-30"
          >
            <span className="text-sm font-semibold text-ink">{row.label}</span>
            <span className="font-display text-lg font-extrabold tabular-nums text-electric-blue">
              {row.count.toLocaleString()}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
