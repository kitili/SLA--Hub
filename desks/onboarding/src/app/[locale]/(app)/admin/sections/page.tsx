import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { listAllSections } from "@/lib/db/queries/admin";

export const metadata: Metadata = {
  title: "Sections — Silverleaf Onboarding Hub",
  description: "Create and manage onboarding sections, items, and quizzes.",
};
import CreateSectionPanel from "@/components/admin/CreateSectionPanel";
import SectionList, {
  type SectionListRow,
} from "@/components/admin/SectionList";
import styles from "@/components/admin/admin.module.css";

export const dynamic = "force-dynamic";

/** Sections CMS landing — list + reorder + publish + create. */
export default async function AdminSectionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  const t = await getTranslations("admin");
  const sections = await listAllSections();

  const rows: SectionListRow[] = sections.map((s) => ({
    id: s.id,
    order: s.order,
    title_en: s.title_en,
    title_sw: s.title_sw,
    icon: s.icon,
    isPublished: s.isPublished,
    itemCount: s.itemCount,
    hasQuiz: s.hasQuiz,
  }));

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>{t("sections.heading")}</h1>
        <p>{t("sections.description")}</p>
      </div>

      <div className={styles.toolbar}>
        <CreateSectionPanel openLabel={t("sections.new")} />
      </div>

      <SectionList rows={rows} />
    </>
  );
}
