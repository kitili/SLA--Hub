import { getLocale, getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { resolveLocalized } from "@/lib/i18n-content";
import { listAllSections } from "@/lib/db/queries/admin";
import styles from "@/components/admin/admin.module.css";

export const dynamic = "force-dynamic";

/** Quizzes CMS landing — one checkpoint per section; link into the authoring view. */
export default async function AdminQuizzesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("admin");
  const sections = await listAllSections();

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>{t("nav.quizzes")}</h1>
        <p>{t("quizzes.description")}</p>
      </div>

      {sections.length === 0 ? (
        <p className={styles.muted}>{t("sections.empty")}</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t("sections.list.title")}</th>
                <th scope="col">{t("sections.list.quiz")}</th>
                <th scope="col">{t("sections.list.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((s) => {
                const title = resolveLocalized(s, "title", locale) ?? s.title_en;
                return (
                  <tr key={s.id}>
                    <td className={styles.nameCell}>
                      {s.icon ? `${s.icon} ` : ""}
                      {title}
                    </td>
                    <td>
                      {s.hasQuiz ? (
                        <span className={`${styles.badge} ${styles.statusDone}`}>
                          {t("sections.list.hasQuiz")}
                        </span>
                      ) : (
                        <span
                          className={`${styles.badge} ${styles.statusNotStarted}`}
                        >
                          {t("sections.list.noQuiz")}
                        </span>
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/admin/quizzes/${s.id}`}
                        className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                      >
                        {t("sections.list.manageQuiz")}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
