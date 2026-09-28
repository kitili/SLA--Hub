"use client";

/**
 * PlansBrowser — accumulating list + "Show more" for the admin plans page.
 *
 * Seeded with the server-rendered first batch ({@link PlanRow}[]). "Show more"
 * calls the `loadMorePlans` server action for the next page and appends it, so
 * the list grows in place without a full navigation or scroll jump.
 *
 * Filter changes are owned by the URL ({@link PlansFilterBar}); the page remounts
 * this component (via `key`) when filters change, resetting the accumulated list
 * back to the new first batch.
 *
 * Row mutations (publish/unpublish/delete) commit via server actions inside
 * {@link PlansTable}, which reports each success back through `onStatusChanged`
 * / `onDeleted` so the accumulated state is patched in place. That callback
 * path is load-bearing: the rows live in `useState`, so the fresh
 * `initialPlans` prop a post-mutation `router.refresh()` delivers can never
 * reach them — and the refreshed first page couldn't describe changes to rows
 * on later "Show more" pages anyway.
 */
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { loadMorePlans } from "@/lib/actions/adminPlans";
import type { PlanFilters, PlanRow } from "@/lib/admin/plansQuery";
import PlansTable from "./PlansTable";
import styles from "./PlansBrowser.module.css";

export interface PlansBrowserProps {
  initialPlans: PlanRow[];
  initialHasMore: boolean;
  filters: PlanFilters;
}

export default function PlansBrowser({
  initialPlans,
  initialHasMore,
  filters,
}: PlansBrowserProps) {
  const t = useTranslations("lpAdmin.plans");
  const [plans, setPlans] = useState<PlanRow[]>(initialPlans);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasActiveFilters = Boolean(
    filters.grade || filters.subject || filters.status || filters.q,
  );

  function onShowMore() {
    setError(null);
    startTransition(async () => {
      try {
        const { rows, hasMore: more } = await loadMorePlans({
          filters,
          offset: plans.length,
        });
        setPlans((prev) => [...prev, ...rows]);
        setHasMore(more);
      } catch {
        setError(t("showMore.error"));
      }
    });
  }

  function onPlanStatusChanged(planId: string, status: PlanRow["status"]) {
    setPlans((prev) =>
      prev.map((p) => (p.id === planId ? { ...p, status } : p)),
    );
  }

  // Dropping the row keeps later "Show more" offsets aligned: `plans.length`
  // shrinks in step with the server-side list (canonical order is stable).
  function onPlanDeleted(planId: string) {
    setPlans((prev) => prev.filter((p) => p.id !== planId));
  }

  // A filtered query with no matches reads differently from an empty catalogue;
  // PlansTable's generic empty state only fits the latter.
  if (plans.length === 0 && hasActiveFilters) {
    return <p className={styles.empty}>{t("emptyFiltered")}</p>;
  }

  return (
    <div>
      <PlansTable
        plans={plans}
        onStatusChanged={onPlanStatusChanged}
        onDeleted={onPlanDeleted}
      />

      {hasMore ? (
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.showMore}
            onClick={onShowMore}
            disabled={pending}
          >
            {pending ? t("showMore.loading") : t("showMore.label")}
          </button>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
