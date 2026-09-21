import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Add Candidate — Silverleaf Onboarding Hub",
  description: "Manually add a new candidate to the hiring pipeline.",
};

import { db } from "@/lib/db/client";
import { jobOpenings } from "@/lib/db/schema";
import { ApplicationForm } from "@/components/hiring/ApplicationForm";
import { Link } from "@/i18n/navigation";
import styles from "@/components/admin/admin.module.css";

export const dynamic = "force-dynamic";

export default async function NewCandidatePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  const t = await getTranslations("admin.hiring.candidate");

  const activePositions = await db
    .select({ title: jobOpenings.title })
    .from(jobOpenings)
    .where(eq(jobOpenings.status, "active"))
    .orderBy(jobOpenings.createdAt);

  const roles = activePositions.map((p) => p.title);

  return (
    <>
      <div className={styles.pageHeader}>
        <Link href="/admin/hiring" className={styles.link}>
          ← {t("backToBoard")}
        </Link>
        <h1>{t("newHeading")}</h1>
        <p className={styles.muted}>{t("newDescription")}</p>
      </div>

      <section className={styles.panel}>
        <ApplicationForm mode="hr" roles={roles} />
      </section>
    </>
  );
}
