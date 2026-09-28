import type { KitchenRecentPurchase } from "@/lib/db/kitchen";

function formatTzs(n: number) {
  return `TZS ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function KitchenRecentPurchasesFeed({
  purchases,
}: {
  purchases: KitchenRecentPurchase[];
}) {
  return (
    <section className="ui-rise mt-6 rounded-[var(--radius)] border border-card-border bg-card p-5 shadow-[var(--shadow)]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-light-blue">
        Activity
      </p>
      <h2 className="mt-1 font-display text-lg font-bold text-ink">Recent purchases</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Latest ingredient purchases logged across every campus.
      </p>

      {purchases.length === 0 ? (
        <p className="mt-4 rounded-[var(--radius-sm)] border border-dashed border-card-border bg-white/60 px-4 py-6 text-center text-sm text-ink-muted">
          No purchases logged yet.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
        <ul className="min-w-[560px] divide-y divide-card-border rounded-[var(--radius-sm)] border border-card-border">
          {purchases.map((p) => (
            <li
              key={p.id}
              className="grid grid-cols-[2fr_1fr_0.8fr_1fr] items-center gap-2 px-3 py-2 text-sm"
            >
              <div>
                <span className="font-semibold text-ink">{p.ingredient_name ?? p.ingredient_id}</span>
                <span className="ml-2 text-ink-muted">
                  {p.quantity} × {Number(p.unit_price).toLocaleString()}
                </span>
              </div>
              <span className="text-xs text-ink-faint">{p.school_name ?? ""}</span>
              <span className="text-right text-xs text-ink-faint">{p.purchased_on ?? ""}</span>
              <span className="text-right font-semibold text-electric-blue">
                {formatTzs(Number(p.total_cost))}
              </span>
            </li>
          ))}
        </ul>
        </div>
      )}
    </section>
  );
}
