import { setRequestLocale } from "next-intl/server";

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
    { name: "Lesson plans", href: `/${locale}/lesson-plans` },
    { name: "Feedback", href: `/${locale}/feedback` },
    { name: "Curriculum", href: CURRICULUM_SITE },
  ];

  return (
    <main className={styles.page}>
      <h1>Academics</h1>
      <div className={styles.grid}>
        {boards.map((board) => (
          <a key={board.name} className={styles.card} href={board.href}>
            {board.name}
          </a>
        ))}
      </div>
    </main>
  );
}
