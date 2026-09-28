import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { feedbackStatus } from "@/lib/actions/feedback";

import FeedbackForm from "./FeedbackForm";
import styles from "./feedback.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Feedback — Silverleaf Onboarding Hub",
  description: "Share your feedback about the Silverleaf Academy onboarding experience.",
};

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}`);
  }

  const t = await getTranslations("feedback");
  const status = await feedbackStatus();

  return (
    <main className={styles.feedbackPage}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("pageTitle")}</h1>
        <p className={styles.subtitle}>{t("pageSubtitle")}</p>
      </header>

      <FeedbackForm
        locale={locale}
        initial={status.feedback}
        alreadySubmitted={status.submitted}
      />
    </main>
  );
}
