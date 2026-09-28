import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Materials — Silverleaf Onboarding Hub",
  description: "Upload and manage onboarding documents, videos, and learning materials.",
};

import {
  listMaterialsWithContext,
  listSectionItemOptions,
} from "@/lib/db/queries/admin";
import CreateMaterialPanel from "@/components/admin/CreateMaterialPanel";
import MaterialActions from "@/components/admin/MaterialActions";
import { type UploadItemOption } from "@/components/admin/MaterialUploadForm";
import styles from "@/components/admin/admin.module.css";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Materials CMS landing — upload + list + replace/delete. */
export default async function AdminMaterialsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  const t = await getTranslations("admin");
  const format = await getFormatter();

  const [materials, itemRows] = await Promise.all([
    listMaterialsWithContext(),
    listSectionItemOptions(),
  ]);

  const itemOptions: UploadItemOption[] = itemRows.map((i) => ({
    id: i.id,
    sectionTitleEn: i.sectionTitleEn,
    titleEn: i.titleEn,
  }));

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>{t("materials.heading")}</h1>
        <p>{t("materials.description")}</p>
      </div>

      <div className={styles.toolbar}>
        <CreateMaterialPanel
          openLabel={t("materials.upload")}
          items={itemOptions}
        />
      </div>

      {materials.length === 0 ? (
        <p className={styles.muted}>{t("materials.empty")}</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t("materials.list.filename")}</th>
                <th scope="col">{t("materials.list.item")}</th>
                <th scope="col">{t("materials.list.language")}</th>
                <th scope="col">{t("materials.list.size")}</th>
                <th scope="col">{t("materials.list.uploaded")}</th>
                <th scope="col">{t("materials.list.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id}>
                  <td className={styles.nameCell}>{m.filename}</td>
                  <td className={styles.muted}>
                    {m.sectionTitleEn && m.itemTitleEn
                      ? `${m.sectionTitleEn} · ${m.itemTitleEn}`
                      : t("common.none")}
                  </td>
                  <td className={styles.muted}>
                    {m.language ? m.language.toUpperCase() : t("common.none")}
                  </td>
                  <td className={styles.muted}>{formatBytes(m.size)}</td>
                  <td className={styles.muted}>
                    {format.dateTime(m.createdAt, { dateStyle: "medium" })}
                  </td>
                  <td>
                    <MaterialActions materialId={m.id} isYoutube={m.contentType === "video/youtube"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
