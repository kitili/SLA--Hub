"use client";

/**
 * PlansTable — admin listing of lesson plans with inline management actions.
 *
 * Client Component: each row exposes Publish/Unpublish, Edit (locale-aware
 * Link), and Delete. Mutations call the `adminPlans` server actions (which
 * re-assert admin and `revalidatePath` the listing), then report the committed
 * change upwards via `onStatusChanged` / `onDeleted`: the rows are
 * PlansBrowser's accumulated client state, which a `router.refresh()` alone
 * cannot update (fresh props never reach state, and the first page can't
 * describe later "Show more" pages). The refresh still runs afterwards so
 * server-rendered bits (e.g. the header count) stay honest. `useTransition`
 * disables the row's controls while a mutation is in flight.
 *
 * Delete asks for confirmation first (irreversible). Action errors surface as a
 * small inline message on the affected row.
 *
 * Mobile-first: rows render as stacked cards on phones and as a table-like grid
 * from ~720px.
 */

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";
import {
  deletePlan,
  publishPlan,
  unpublishPlan,
  type AdminActionResult,
} from "@/lib/actions/adminPlans";
import type { PlanRow } from "@/lib/admin/plansQuery";
import styles from "./PlansTable.module.css";

export type { PlanRow };

export interface PlansTableProps {
  plans: PlanRow[];
  /** A status flip committed — the owner of `plans` should patch the row. */
  onStatusChanged: (planId: string, status: PlanRow["status"]) => void;
  /** A delete committed — the owner of `plans` should drop the row. */
  onDeleted: (planId: string) => void;
}

function PlanRowItem({
  plan,
  onStatusChanged,
  onDeleted,
}: {
  plan: PlanRow;
  onStatusChanged: PlansTableProps["onStatusChanged"];
  onDeleted: PlansTableProps["onDeleted"];
}) {
  const router = useRouter();
  const t = useTranslations("lpAdmin.plans.table");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isPublished = plan.status === "published";

  function run(
    action: () => Promise<AdminActionResult>,
    onSuccess: () => void,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        // "conflict" = delete blocked by usage/feedback history.
        setError(
          result.error === "conflict" ? t("deleteConflict") : t("genericError"),
        );
        return;
      }
      onSuccess();
      router.refresh();
    });
  }

  function onToggle() {
    if (isPublished) {
      run(
        () => unpublishPlan(plan.id),
        () => onStatusChanged(plan.id, "draft"),
      );
    } else {
      run(
        () => publishPlan(plan.id),
        () => onStatusChanged(plan.id, "published"),
      );
    }
  }

  function onDelete() {
    const confirmed = window.confirm(
      t("confirmDelete", { title: plan.title }),
    );
    if (!confirmed) return;
    run(
      () => deletePlan(plan.id),
      () => onDeleted(plan.id),
    );
  }

  return (
    <li className={styles.row} data-pending={pending ? "" : undefined}>
      <div className={styles.cellTitle}>
        <Link href={`/admin/plans/${plan.slug}/edit`} className={styles.title}>
          {plan.title}
        </Link>
        <span className={styles.slug}>{plan.slug}</span>
      </div>

      <div className={styles.cellMeta}>
        <span className={styles.metaItem}>{plan.grade}</span>
        <span className={styles.metaItem}>{plan.subject}</span>
        <span className={styles.metaItem}>
          T{plan.term} · W{plan.week} · L{plan.lesson}
        </span>
      </div>

      <div className={styles.cellStatus}>
        <span
          className={
            isPublished
              ? `${styles.badge} ${styles.badgePublished}`
              : `${styles.badge} ${styles.badgeDraft}`
          }
        >
          {isPublished ? t("published") : t("draft")}
        </span>
      </div>

      <div className={styles.cellActions}>
        <button
          type="button"
          className={styles.btn}
          onClick={onToggle}
          disabled={pending}
        >
          {isPublished ? t("unpublish") : t("publish")}
        </button>
        <Link
          href={`/admin/plans/${plan.slug}/edit`}
          className={styles.btnLink}
        >
          {t("edit")}
        </Link>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnDanger}`}
          onClick={onDelete}
          disabled={pending}
        >
          {t("delete")}
        </button>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}

export default function PlansTable({
  plans,
  onStatusChanged,
  onDeleted,
}: PlansTableProps) {
  const t = useTranslations("lpAdmin.plans");

  if (plans.length === 0) {
    return <p className={styles.empty}>{t("empty")}</p>;
  }

  return (
    <ul className={styles.list}>
      <li className={styles.headerRow} aria-hidden="true">
        <span>{t("table.plan")}</span>
        <span>{t("table.details")}</span>
        <span>{t("table.status")}</span>
        <span className={styles.headerActions}>{t("table.actions")}</span>
      </li>
      {plans.map((plan) => (
        <PlanRowItem
          key={plan.id}
          plan={plan}
          onStatusChanged={onStatusChanged}
          onDeleted={onDeleted}
        />
      ))}
    </ul>
  );
}
