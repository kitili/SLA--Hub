"use client";

/**
 * SearchFilters — the interactive search controls for the lesson-plan catalogue.
 *
 * The URL querystring is the single source of truth: every control reads its
 * current value from `useSearchParams()` and, on change, pushes an updated
 * querystring so the (force-dynamic) server page re-runs the query. We use the
 * locale-aware `useRouter`/`usePathname` from `@/i18n/navigation` so the active
 * locale is preserved.
 *
 * Behaviour:
 *  - Text box: controlled local state, debounced ~300ms before it hits the URL
 *    (so typing doesn't fire a request per keystroke). Submitting the form
 *    flushes immediately.
 *  - Facets (subject / grade / term): multi-select toggle chips. Selecting a
 *    chip adds its value to that facet's repeated query param; deselecting
 *    removes it.
 *  - Sort: a two-way toggle (Relevance / Browse order). Relevance is only
 *    meaningful with a text query, so it's disabled when the box is empty.
 *  - Any change to a filter resets pagination back to page 1.
 *
 * All controls are >= 44px tall for comfortable tapping on phones.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import styles from "./SearchFilters.module.css";

/** One selectable facet bucket. */
export interface FacetOption {
  value: string;
  count: number;
}

export interface SearchFiltersProps {
  /** The current text query (from the URL) — seeds the input. */
  q: string;
  /** Available facet buckets for the current query. */
  subjects: FacetOption[];
  grades: FacetOption[];
  terms: FacetOption[];
  /** Currently-selected facet values (from the URL). */
  selectedSubjects: string[];
  selectedGrades: string[];
  selectedTerms: string[];
  /** Current sort mode (from the URL). */
  sort: "relevance" | "naming";
}

/** Debounce window before a keystroke change is committed to the URL. */
const DEBOUNCE_MS = 300;

export default function SearchFilters({
  q,
  subjects,
  grades,
  terms,
  selectedSubjects,
  selectedGrades,
  selectedTerms,
  sort,
}: SearchFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("lpSearch");

  // Controlled text input, seeded from the URL and kept in sync if the URL `q`
  // changes underneath us (e.g. back/forward navigation).
  const [text, setText] = useState(q);
  useEffect(() => {
    setText(q);
  }, [q]);

  /**
   * Push a new querystring built from the *current* URL plus a set of mutations.
   * `null` deletes a key; a string sets it; a string[] sets repeated values.
   * Any mutation drops `page` so results restart at page 1.
   */
  function commit(mutations: Record<string, string | string[] | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(mutations)) {
      params.delete(key);
      if (Array.isArray(value)) {
        for (const v of value) params.append(key, v);
      } else if (value !== null && value !== "") {
        params.set(key, value);
      }
    }
    // Filter changes always reset pagination.
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  // Debounce committing the text box to the URL.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onTextChange(next: string) {
    setText(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      commit({ q: next.trim() || null });
    }, DEBOUNCE_MS);
  }

  // Clear any pending debounce on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    commit({ q: text.trim() || null });
  }

  function clearText() {
    setText("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    commit({ q: null });
  }

  /** Toggle a value within a repeated facet param. */
  function toggleFacet(key: "subject" | "grade" | "term", value: string) {
    const current = searchParams.getAll(key);
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    commit({ [key]: next });
  }

  function setSort(next: "relevance" | "naming") {
    // Default sort is naming; only persist `sort` when it diverges.
    commit({ sort: next === "naming" ? null : next });
  }

  const hasQuery = text.trim() !== "";
  const hasAnyFacet =
    selectedSubjects.length > 0 ||
    selectedGrades.length > 0 ||
    selectedTerms.length > 0;

  function clearAll() {
    setText("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    commit({ q: null, subject: [], grade: [], term: [], sort: null });
  }

  return (
    <div
      className={styles.filters}
      data-pending={isPending ? "true" : undefined}
    >
      <form className={styles.searchRow} onSubmit={onSubmit} role="search">
        <div className={styles.searchBox}>
          <input
            type="search"
            name="q"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder={t("placeholder")}
            aria-label={t("ariaLabel")}
            className={styles.searchInput}
            autoComplete="off"
          />
          {text ? (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={clearText}
              aria-label={t("clearSearch")}
            >
              ×
            </button>
          ) : null}
        </div>
        <button type="submit" className={styles.searchSubmit}>
          {t("submit")}
        </button>
      </form>

      <div className={styles.sortRow}>
        <span className={styles.sortLabel}>{t("sort")}</span>
        <div
          className={styles.sortToggle}
          role="group"
          aria-label={t("sortAriaLabel")}
        >
          <button
            type="button"
            className={styles.sortOption}
            aria-pressed={sort === "relevance"}
            disabled={!hasQuery}
            title={
              hasQuery
                ? t("relevanceEnabledHint")
                : t("relevanceDisabledHint")
            }
            onClick={() => setSort("relevance")}
          >
            {t("relevance")}
          </button>
          <button
            type="button"
            className={styles.sortOption}
            aria-pressed={sort === "naming"}
            onClick={() => setSort("naming")}
          >
            {t("browseOrder")}
          </button>
        </div>
        {(hasQuery || hasAnyFacet) && (
          <button type="button" className={styles.clearAll} onClick={clearAll}>
            {t("clearAll")}
          </button>
        )}
      </div>

      <FacetGroup
        legend={t("facets.subject")}
        paramKey="subject"
        options={subjects}
        selected={selectedSubjects}
        onToggle={toggleFacet}
        labelOf={(v) => v}
      />
      <FacetGroup
        legend={t("facets.grade")}
        paramKey="grade"
        options={grades}
        selected={selectedGrades}
        onToggle={toggleFacet}
        labelOf={(v) => v}
      />
      <FacetGroup
        legend={t("facets.term")}
        paramKey="term"
        options={terms}
        selected={selectedTerms}
        onToggle={toggleFacet}
        labelOf={(v) => t("termLabel", { value: v })}
      />
    </div>
  );
}

interface FacetGroupProps {
  legend: string;
  paramKey: "subject" | "grade" | "term";
  options: FacetOption[];
  selected: string[];
  onToggle: (key: "subject" | "grade" | "term", value: string) => void;
  labelOf: (value: string) => string;
}

/** A labelled group of multi-select facet chips. */
function FacetGroup({
  legend,
  paramKey,
  options,
  selected,
  onToggle,
  labelOf,
}: FacetGroupProps) {
  if (options.length === 0) return null;

  return (
    <fieldset className={styles.facetGroup}>
      <legend className={styles.facetLegend}>{legend}</legend>
      <div className={styles.chips}>
        {options.map((opt) => {
          const isOn = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              className={styles.chip}
              aria-pressed={isOn}
              onClick={() => onToggle(paramKey, opt.value)}
            >
              <span className={styles.chipLabel}>{labelOf(opt.value)}</span>
              <span className={styles.chipCount}>{opt.count}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
