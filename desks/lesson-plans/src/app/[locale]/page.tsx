import { setRequestLocale } from "next-intl/server";

import styles from "./boards.module.css";

export const dynamic = "force-dynamic";

const boards = [
  { name: "Lesson plans", path: "lesson-plans" },
  { name: "Silverleaf Feedback", path: "feedback" },
  { name: "Silverleaf Curriculum", path: "curriculum" },
];

export default async function AcademicsBoardsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className={styles.shell}>
      {boards.map((board) => (
        <section key={board.name} className={styles.card}>
          <h1>{board.name}</h1>
          <iframe title={board.name} src={`/${locale}/${board.path}`} />
        </section>
      ))}
    </main>
  );
}
