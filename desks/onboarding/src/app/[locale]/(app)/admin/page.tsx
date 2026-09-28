import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import AdminPortalHome from "@/components/admin/AdminPortalHome";
import styles from "@/components/admin/admin.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Portal — Silverleaf Onboarding Hub",
  description: "Manage staff onboarding and the hiring pipeline.",
};

/** HR backend home — pick Onboarding admin or Hiring portal. */
export default async function AdminHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  const t = await getTranslations("admin.portal");

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>{t("heading")}</h1>
        <p>{t("description")}</p>
      </div>
      <AdminPortalHome />
    </>
  );
}
