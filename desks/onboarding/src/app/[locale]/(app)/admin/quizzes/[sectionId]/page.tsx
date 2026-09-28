import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { resolveLocalized } from "@/lib/i18n-content";
import { findSection, getQuizForSectionAdmin } from "@/lib/db/queries/admin";
import QuizEditor, {
  type QuizEditorData,
} from "@/components/admin/QuizEditor";
import styles from "@/components/admin/admin.module.css";

export const dynamic = "force-dynamic";

/** Quiz authoring for a single section's checkpoint. */
export default async function AdminQuizEditPage({
  params,
}: {
  params: Promise<{ locale: string; sectionId: string }>;
}) {
  const { sectionId } = await params;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("admin");

  const section = await findSection(sectionId);
  if (!section) notFound();

  const quiz = await getQuizForSectionAdmin(sectionId);
  const sectionTitle =
    resolveLocalized(section, "title", locale) ?? section.title_en;

  const data: QuizEditorData = {
    sectionId,
    sectionTitle,
    passThreshold: quiz?.passThreshold ?? 1,
    questions: (quiz?.questions ?? []).map((q) => ({
      id: q.id,
      text_en: q.text_en,
      text_sw: q.text_sw,
      options: q.options.map((o) => ({
        id: o.id,
        text_en: o.text_en,
        text_sw: o.text_sw,
        isCorrect: o.isCorrect,
      })),
    })),
  };

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>{t("quizzes.heading")}</h1>
        <p className={styles.linkRow}>
          <Link href="/admin/quizzes">← {t("nav.quizzes")}</Link>
          <span className={styles.muted}>
            {t("quizzes.forSection", { section: sectionTitle })}
          </span>
        </p>
      </div>

      <QuizEditor quiz={data} />
    </>
  );
}
