import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/auth";
import {
  countPlans,
  fetchPlanFilterOptions,
  fetchPlansPage,
  PAGE_SIZE,
  parsePlanFilters,
} from "@/lib/admin/plansQuery";
import PlansBrowser from "@/components/admin/PlansBrowser";
import PlansFilterBar from "@/components/admin/PlansFilterBar";

/** Live, authenticated data — render on demand (never prerender/cache). */
export const dynamic = "force-dynamic";

/**
 * Admin plans listing.
 *
 * Filterable (grade / subject / status / free-text) via URL query params and
 * ordered by the canonical naming sort (grade → subject → term → week → lesson).
 * Renders only the first {@link PAGE_SIZE} rows; the client {@link PlansBrowser}
 * grows the list in place via its "Show more" control, while {@link PlansTable}
 * (inside it) owns the publish/unpublish/delete actions and edit links.
 */
export default async function AdminPlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const t = await getTranslations("lpAdmin.plans");

  const filters = parsePlanFilters(await searchParams);

  const [options, total, rows] = await Promise.all([
    fetchPlanFilterOptions(),
    countPlans(filters),
    fetchPlansPage(filters, { offset: 0, limit: PAGE_SIZE }),
  ]);

  const initialHasMore = total > rows.length;
  // Re-key the browser on the active filters so a filter change resets the
  // accumulated "Show more" list back to the new first batch.
  const filterKey = JSON.stringify(filters);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "0.75rem",
          marginBottom: "1.25rem",
          flexWrap: "wrap",
        }}
      >
        <h1>{t("heading")}</h1>
        <span style={{ fontSize: "0.875rem", color: "var(--ink-muted)" }}>
          {t("count", { count: total })}
        </span>
      </div>

      <PlansFilterBar options={options} filters={filters} />

      <PlansBrowser
        key={filterKey}
        initialPlans={rows}
        initialHasMore={initialHasMore}
        filters={filters}
      />
    </div>
  );
}
