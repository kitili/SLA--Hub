"use client";

/**
 * RecordPicker — a precise, searchable combobox/list for choosing exactly one
 * record (e.g. a SOW lesson row) from a list.
 *
 * The generic `T` is the option type. Callers supply:
 *  - `items`        the candidate records;
 *  - `getKey`       a stable React key per record;
 *  - `getPrimary`   the disambiguating one-line label (e.g. "W3 · L2 · …");
 *  - `getSecondary` an optional snippet shown under the primary line;
 *  - `filterText`   the text used for local fuzzy matching;
 *  - `onSelect`     called with the chosen record.
 *
 * Filtering is purely client-side over `filterText`.
 *
 * The selected record is rendered by the parent as a confirmable summary card,
 * so this component focuses on the search → list → pick interaction only.
 */
import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import styles from "./RecordPicker.module.css";

interface RecordPickerProps<T> {
  items: T[];
  getKey: (item: T) => string;
  getPrimary: (item: T) => string;
  getSecondary?: (item: T) => string | null | undefined;
  /** Local match text. */
  filterText?: (item: T) => string;
  onSelect: (item: T) => void;
  /** Optional placeholder for the search box. */
  placeholder?: string;
  /** Optional empty-state message when nothing matches. */
  emptyLabel?: string;
  /** Cap the number of rows rendered (perf). Default 50. */
  maxRows?: number;
  /** Currently-selected key, to mark the active row. */
  selectedKey?: string | null;
}

export default function RecordPicker<T>({
  items,
  getKey,
  getPrimary,
  getSecondary,
  filterText,
  onSelect,
  placeholder,
  emptyLabel,
  maxRows = 50,
  selectedKey,
}: RecordPickerProps<T>) {
  const t = useTranslations("lpStudio");
  const listId = useId();
  const [query, setQuery] = useState("");

  const localFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    if (!filterText) return items;
    return items.filter((it) => filterText(it).toLowerCase().includes(q));
  }, [items, query, filterText]);

  const rows = localFiltered.slice(0, maxRows);

  return (
    <div className={styles.picker}>
      <div className={styles.searchRow}>
        <span className={styles.searchIcon} aria-hidden="true">
          {/* magnifier */}
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none">
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
            <path
              d="m14 14 4 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <input
          type="search"
          className={styles.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? t("picker.searchPlaceholder")}
          aria-controls={listId}
          aria-label={placeholder ?? t("picker.searchPlaceholder")}
        />
      </div>

      <ul id={listId} className={styles.list} role="listbox">
        {rows.length === 0 ? (
          <li className={styles.empty}>{emptyLabel ?? t("picker.noResults")}</li>
        ) : (
          rows.map((item) => {
            const key = getKey(item);
            const secondary = getSecondary?.(item);
            const active = selectedKey === key;
            return (
              <li key={key} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={
                    active ? `${styles.option} ${styles.optionActive}` : styles.option
                  }
                  onClick={() => onSelect(item)}
                >
                  <span className={styles.primary}>{getPrimary(item)}</span>
                  {secondary ? (
                    <span className={styles.secondary}>{secondary}</span>
                  ) : null}
                </button>
              </li>
            );
          })
        )}
      </ul>
      {rows.length === maxRows && (
        <p className={styles.more}>{t("picker.refineHint")}</p>
      )}
    </div>
  );
}
