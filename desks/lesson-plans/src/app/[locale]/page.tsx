import { setRequestLocale } from "next-intl/server";

import { brand } from "@/lib/brand";
import styles from "./boards.module.css";

export const dynamic = "force-dynamic";

const CURRICULUM_SITE =
  "https://script.google.com/a/macros/silverleaf.co.tz/s/AKfycbwW0yPd4KdPtUXYaCloIIGgfOA2eGXzyGSdlhwOpnubE03tOWbq9dggUJhLLRzj_iED3Q/exec";

export default async function AcademicsBoardsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const boards = [
    { name: "Lesson plans", detail: "Find a plan and teach it this week.", href: `/${locale}/lesson-plans` },
    { name: "Feedback", detail: "What teachers said about tools and training.", href: `/${locale}/feedback` },
    { name: "Curriculum", detail: "Coverage across grades, subjects and terms.", href: CURRICULUM_SITE },
    { name: "KG checklist", detail: "Development index by campus and class.", href: `/${locale}/kg` },
    { name: "Assessments", detail: "EGRA, EGMA and social-emotional results.", href: `/${locale}/assessment` },
    { name: "Instructional leadership", detail: "Campus walkthroughs and teacher observations.", href: `/${locale}/leadership` },
  ];

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <img className={styles.mark} src={brand.logos.logomarkWhite} alt="" width={42} height={54} />
        <div className={styles.copy}>
          <span className={styles.kicker}>Silverleaf Academy</span>
          <h1>Academics</h1>
          <p>Lesson plans, feedback, curriculum, the kindergarten checklist, reading assessments, and instructional leadership.</p>
        </div>
      </header>
      <div className={styles.grid}>
        {boards.map((board) => (
          <a key={board.name} className={styles.card} href={board.href}>
            <strong>{board.name}</strong>
            <span>{board.detail}</span>
          </a>
        ))}
      </div>
    </main>
  );
}
