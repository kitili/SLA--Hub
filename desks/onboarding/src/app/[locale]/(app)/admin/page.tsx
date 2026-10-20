import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import AdminPortalHome from "@/components/admin/AdminPortalHome";
import { readHubHandoffs } from "@/lib/hub-bridge";
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
  const fromOtherDesks = await readHubHandoffs("onboarding");

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>{t("heading")}</h1>
        <p>{t("description")}</p>
      </div>
      {fromOtherDesks.length > 0 ? (
        <section className={styles.pageHeader}>
          <h2>From other desks</h2>
          {fromOtherDesks.map((row) => (
            <p key={row.id}>
              {row.from}: {row.title}. {row.facts.map((fact) => `${fact.label} ${fact.value}`).join(" · ")}
            </p>
          ))}
        </section>
      ) : null}
      <AdminPortalHome />
    </>
  );
}
