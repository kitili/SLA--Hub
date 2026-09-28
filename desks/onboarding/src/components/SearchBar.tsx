"use client";

/**
 * SearchBar — live search over onboarding document items.
 *
 * Ported from legacy/client/src/components/SearchBar.jsx.
 * react-router-dom Link → next/link; HubContentContext → items prop.
 *
 * TODO(M data-model): replace SearchableItem with the real type from the
 *   data layer once sections/items are loaded server-side.
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import styles from "./SearchBar.module.css";

/** Flat item shape used for full-text search. */
export interface SearchableItem {
  id: string;
  title: string;
  sectionId: string;
  sectionNumber: number;
  sectionTitle: string;
}

export interface SearchBarProps {
  /** TODO(M data-model): all searchable items from onboardingData */
  items?: SearchableItem[];
  placeholder?: string;
}

export default function SearchBar({
  items = [],
  placeholder = "Search documents...",
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.sectionTitle.toLowerCase().includes(q)
    );
  }, [query, items]);

  const boxClass = [
    styles.searchBox,
    focused ? styles.searchBoxFocused : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.searchContainer}>
      <div className={boxClass}>
        <span className={styles.searchIcon} aria-hidden>🔍</span>
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          className={styles.searchInput}
          aria-label="Search documents"
          aria-controls="search-results-list"
          aria-autocomplete="list"
        />
      </div>

      {focused && query.trim() && (
        <div id="search-results-list" className={styles.searchResults} role="listbox">
          {results.length === 0 ? (
            <p className={styles.searchEmpty}>No results for &ldquo;{query}&rdquo;</p>
          ) : (
            results.slice(0, 8).map((item) => (
              <Link
                key={item.id}
                href={`/section/${item.sectionId}`}
                className={styles.searchResultItem}
                role="option"
                aria-selected={false}
              >
                <div>
                  <span className={styles.resultTitle}>{item.title}</span>
                  <span className={styles.resultSection}>
                    Section {item.sectionNumber}: {item.sectionTitle}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
