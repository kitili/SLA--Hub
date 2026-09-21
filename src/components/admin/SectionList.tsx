"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { Locale } from "@/i18n/routing";
import { Link, useRouter } from "@/i18n/navigation";
import { resolveLocalized } from "@/lib/i18n-content";
import {
  moveSectionAction,
  toggleSectionPublishedAction,
} from "@/lib/actions/admin";
import styles from "./admin.module.css";

export interface SectionListRow {
  id: string;
  order: number;
  title_en: string;
  title_sw: string | null;
  icon: string | null;
  isPublished: boolean;
  itemCount: number;
  hasQuiz: boolean;
}

export default function SectionList({ rows }: { rows: SectionListRow[] }) {
  const t = useTranslations("admin");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function run(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    startTransition(async () => {
      await fn();
      router.refresh();
      setBusyId(null);
    });
  }

  if (rows.length === 0) {
    return <p className={styles.muted}>{t("sections.empty")}</p>;
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{t("sections.list.order")}</th>
            <th scope="col">{t("sections.list.title")}</th>
            <th scope="col">{t("sections.list.items")}</th>
            <th scope="col">{t("sections.list.quiz")}</th>
            <th scope="col">{t("sections.list.status")}</th>
            <th scope="col">{t("sections.list.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const title =
              resolveLocalized(row, "title", locale) ?? row.title_en;
            const swMissing = !row.title_sw;
            const rowBusy = pending && busyId === row.id;
            return (
              <tr key={row.id}>
                <td>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label={t("common.moveUp")}
                      disabled={idx === 0 || rowBusy}
                      onClick={() =>
                        run(row.id, () => moveSectionAction(row.id, "up"))
                      }
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label={t("common.moveDown")}
                      disabled={idx === rows.length - 1 || rowBusy}
                      onClick={() =>
                        run(row.id, () => moveSectionAction(row.id, "down"))
                      }
                    >
                      ▼
                    </button>
                  </div>
                </td>
                <td className={styles.nameCell}>
                  {row.icon ? `${row.icon} ` : ""}
                  {title}
                  {swMissing && (
                    <span className={styles.pendingTag}>
                      {t("common.translationPending")}
                    </span>
                  )}
                  <div className={styles.muted}>{row.id}</div>
                </td>
                <td>{t("sections.list.itemCount", { count: row.itemCount })}</td>
                <td>
                  {row.hasQuiz ? (
                    <span className={`${styles.badge} ${styles.statusDone}`}>
                      {t("sections.list.hasQuiz")}
                    </span>
                  ) : (
                    <span className={`${styles.badge} ${styles.statusNotStarted}`}>
                      {t("sections.list.noQuiz")}
                    </span>
                  )}
                </td>
                <td>
                  {row.isPublished ? (
                    <span className={`${styles.badge} ${styles.statusDone}`}>
                      {t("common.published")}
                    </span>
                  ) : (
                    <span
                      className={`${styles.badge} ${styles.statusNotStarted}`}
                    >
                      {t("common.hidden")}
                    </span>
                  )}
                </td>
                <td>
                  <div className={styles.actions}>
                    <Link
                      href={`/admin/sections/${row.id}`}
                      className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                    >
                      {t("common.edit")}
                    </Link>
                    <Link
                      href={`/admin/sections/${row.id}?addItem=1`}
                      className={`${styles.btn} ${styles.btnSmall}`}
                    >
                      {t("sections.items.new")}
                    </Link>
                    <Link
                      href={`/admin/quizzes/${row.id}`}
                      className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                    >
                      {t("sections.list.manageQuiz")}
                    </Link>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                      disabled={rowBusy}
                      onClick={() =>
                        run(row.id, () =>
                          toggleSectionPublishedAction(row.id, !row.isPublished),
                        )
                      }
                    >
                      {row.isPublished
                        ? t("common.unpublish")
                        : t("common.publish")}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
