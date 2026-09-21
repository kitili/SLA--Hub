import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { resolveLocalized } from "@/lib/i18n-content";
import {
  findSection,
  listSectionItemsWithMaterials,
} from "@/lib/db/queries/admin";
import { policyBriefingsRepo } from "@/lib/db/repositories";
import {
  isExtractablePolicyFile,
  isPolicySection,
  parseBriefingScript,
} from "@/lib/policy-briefing-script";
import SectionForm, {
  type SectionFormValues,
} from "@/components/admin/SectionForm";
import CreateSectionItemPanel from "@/components/admin/CreateSectionItemPanel";
import MaterialActions from "@/components/admin/MaterialActions";
import PolicyBriefingReview, {
  type PolicyBriefingAdminItem,
} from "@/components/admin/PolicyBriefingReview";
import styles from "@/components/admin/admin.module.css";

export const dynamic = "force-dynamic";

/** Edit a single section + view its items and attached materials. */
export default async function AdminSectionEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; sectionId: string }>;
  searchParams: Promise<{ addItem?: string }>;
}) {
  const { sectionId } = await params;
  const { addItem } = await searchParams;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("admin");

  const section = await findSection(sectionId);
  if (!section) notFound();

  const items = await listSectionItemsWithMaterials(sectionId);
  const openAddItem = addItem === "1";

  const latestBriefings = isPolicySection(section.id)
    ? await policyBriefingsRepo.listLatestBriefingsForItems(items.map((i) => i.id))
    : [];
  const latestByItem = new Map(
    latestBriefings.map((row) => [row.sectionItemId, row]),
  );
  const briefingItems: PolicyBriefingAdminItem[] = items.map((item) => {
    const latest = latestByItem.get(item.id);
    const parsed = latest ? parseBriefingScript(latest.scriptEn) : null;
    const status = latest?.status;
    return {
      itemId: item.id,
      itemTitle: resolveLocalized(item, "title", locale) ?? item.title_en,
      hasDocument: item.materials.some((m) =>
        isExtractablePolicyFile(m.filename, m.contentType),
      ),
      latest: latest
        ? {
            id: latest.id,
            status:
              status === "generating" ||
              status === "draft" ||
              status === "published" ||
              status === "failed"
                ? status
                : "failed",
            generator: latest.generator,
            errorMessage: latest.errorMessage,
            sourceFilename: latest.sourceFilename,
            createdAtISO: latest.createdAt.toISOString(),
            script: parsed ?? {
              title: item.title_en,
              intro: "",
              chapters: [],
              close: "",
              nextStep: "",
            },
          }
        : null,
    };
  });

  const initial: SectionFormValues = {
    id: section.id,
    icon: section.icon,
    title_en: section.title_en,
    title_sw: section.title_sw,
    description_en: section.description_en,
    description_sw: section.description_sw,
  };

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>{t("sections.edit")}</h1>
        <p className={styles.linkRow}>
          <Link href="/admin/sections">← {t("sections.heading")}</Link>
          <Link href={`/admin/quizzes/${section.id}`}>
            {t("sections.list.manageQuiz")}
          </Link>
        </p>
      </div>

      <div className={styles.card}>
        <SectionForm mode="edit" initial={initial} />
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>{t("sections.list.manageItems")}</h2>
          <Link
            href="/admin/materials"
            className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
          >
            {t("materials.upload")}
          </Link>
        </div>

        <CreateSectionItemPanel
          sectionId={section.id}
          initiallyOpen={openAddItem}
        />

        {items.length === 0 ? (
          <p className={styles.muted}>{t("sections.list.itemCount", { count: 0 })}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t("sections.list.title")}</th>
                  <th scope="col">{t("materials.list.filename")}</th>
                  <th scope="col">{t("materials.list.language")}</th>
                  <th scope="col">{t("materials.list.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const itemTitle =
                    resolveLocalized(item, "title", locale) ?? item.title_en;
                  if (item.materials.length === 0) {
                    return (
                      <tr key={item.id}>
                        <td className={styles.nameCell}>{itemTitle}</td>
                        <td className={styles.muted} colSpan={3}>
                          {t("common.none")}
                        </td>
                      </tr>
                    );
                  }
                  return item.materials.map((mat, mi) => (
                    <tr key={mat.id}>
                      {mi === 0 ? (
                        <td
                          className={styles.nameCell}
                          rowSpan={item.materials.length}
                        >
                          {itemTitle}
                        </td>
                      ) : null}
                      <td>{mat.filename}</td>
                      <td className={styles.muted}>
                        {mat.language
                          ? mat.language.toUpperCase()
                          : t("common.none")}
                      </td>
                      <td>
                        <MaterialActions materialId={mat.id} isYoutube={mat.contentType === "video/youtube"} />
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isPolicySection(section.id) && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>{t("briefings.heading")}</h2>
          </div>
          <PolicyBriefingReview items={briefingItems} />
        </div>
      )}
    </>
  );
}
