"use client";

/**
 * SowPreviewTable — the 12-column (week + lesson number + the 10 lesson
 * columns) review table shown before a parsed SOW upload is committed.
 *
 * Shared by the Studio's Scheme & Lesson panel and the Schemes admin page so
 * the column set, order, and labels exist exactly once. Labels come from the
 * canonical `lpStudio.scheme.columns` i18n group; styling stays with the
 * caller via the `classNames` prop (each page keeps its own CSS module).
 */
import { useTranslations } from "next-intl";

import { LESSON_COLUMN_KEYS, type LessonColumns } from "./types";

/** One parsed row — structurally satisfied by `ParsedSowRow`. */
export type SowPreviewRow = Partial<LessonColumns> & {
  week?: number | null;
  lessonNumber?: string | null;
};

export default function SowPreviewTable({
  rows,
  classNames,
}: {
  rows: SowPreviewRow[];
  /** CSS-module classes from the calling page (`undefined` when absent). */
  classNames: {
    /** Scrollable wrapper around the (wide) table. */
    wrapper: string | undefined;
    table: string | undefined;
    /** Optional class for the lesson-column cells (e.g. line clamping). */
    cell?: string | undefined;
  };
}) {
  const t = useTranslations("lpStudio.scheme.columns");

  return (
    <div className={classNames.wrapper}>
      <table className={classNames.table}>
        <thead>
          <tr>
            <th>{t("week")}</th>
            <th>{t("lessonNumber")}</th>
            {LESSON_COLUMN_KEYS.map((key) => (
              <th key={key}>{t(key)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td>{row.week ?? "—"}</td>
              <td>{row.lessonNumber ?? "—"}</td>
              {LESSON_COLUMN_KEYS.map((key) => (
                <td key={key} className={classNames.cell}>
                  {row[key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
