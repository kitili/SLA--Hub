import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { jobOpenings } from "@/lib/db/schema";
import { ApplicationForm } from "@/components/hiring/ApplicationForm";
import styles from "@/components/hiring/hiring.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Apply — Silverleaf Academy",
  description: "Apply for a role at Silverleaf Academy.",
};

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const activePositions = await db
    .select({ title: jobOpenings.title })
    .from(jobOpenings)
    .where(eq(jobOpenings.status, "active"))
    .orderBy(jobOpenings.createdAt);

  const roles = activePositions.map((p) => p.title);

  return (
    <div className={styles.applyPage}>
      <div className={styles.applyInner}>
        <header className={styles.applyHeader}>
          <p className={styles.kicker}>Silverleaf Academy</p>
          <h1>Apply for a role</h1>
          <p className={styles.muted}>
            Complete the form below. We will review your application and be in
            touch if we would like to move forward.
          </p>
        </header>
        <div className={styles.applyCard}>
          <ApplicationForm mode="public" roles={roles} />
        </div>
      </div>
    </div>
  );
}
