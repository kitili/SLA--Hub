"use client";

/**
 * PlansFilterBar — admin filter controls for the plans listing.
 *
 * URL-driven: every change is written to the query string (`?grade=&subject=
 * &status=&q=`) via a locale-aware `router.replace`, so the server page
 * re-renders the first filtered batch and the state is shareable / bookmarkable.
 * The text search debounces before navigating; the selects navigate immediately.
 *
 * A pending transition dims the bar while the new page streams in.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import type { PlanFilters, PlanFilterOptions } from "@/lib/admin/plansQuery";
import styles from "./PlansFilterBar.module.css";

export interface PlansFilterBarProps {
  options: PlanFilterOptions;
  filters: PlanFilters;
}

export default function PlansFilterBar({
  options,
  filters,
}: PlansFilterBarProps) {
  const t = useTranslations("lpAdmin.plans.filters");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Local mirror of the search box so typing is responsive; committed (to the
  // URL) on a short debounce.
  const [query, setQuery] = useState(filters.q ?? "");

  // Keep the box in sync when the URL changes from elsewhere (e.g. Clear).
  useEffect(() => {
    setQuery(filters.q ?? "");
  }, [filters.q]);

  /** Write a single param (clearing it when empty) and navigate. */
  function commit(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  // Debounce the free-text search.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commit("q", value.trim()), 300);
  }

  const hasFilters = Boolean(
    filters.grade || filters.subject || filters.status || filters.q,
  );

  function clearAll() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQuery("");
    startTransition(() => router.replace(pathname));
  }

  return (
    <div
      className={styles.bar}
      data-pending={pending ? "" : undefined}
      role="search"
    >
      <div className={styles.searchBox}>
        <input
          type="search"
          className={styles.search}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchLabel")}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>

      <select
        className={styles.select}
        aria-label={t("gradeLabel")}
        value={filters.grade ?? ""}
        onChange={(e) => commit("grade", e.target.value)}
      >
        <option value="">{t("allGrades")}</option>
        {options.grades.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>

      <select
        className={styles.select}
        aria-label={t("subjectLabel")}
        value={filters.subject ?? ""}
        onChange={(e) => commit("subject", e.target.value)}
      >
        <option value="">{t("allSubjects")}</option>
        {options.subjects.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        className={styles.select}
        aria-label={t("statusLabel")}
        value={filters.status ?? ""}
        onChange={(e) => commit("status", e.target.value)}
      >
        <option value="">{t("allStatuses")}</option>
        <option value="published">{t("published")}</option>
        <option value="draft">{t("draft")}</option>
      </select>

      {hasFilters ? (
        <button type="button" className={styles.clear} onClick={clearAll}>
          {t("clear")}
        </button>
      ) : null}
    </div>
  );
}
