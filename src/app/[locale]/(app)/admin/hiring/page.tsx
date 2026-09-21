import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AdvanceButtons } from "@/components/hiring/AdvanceButtons";
import { HiringBoardToolbar } from "@/components/hiring/HiringBoardToolbar";

export const metadata: Metadata = {
  title: "Hiring Pipeline — Silverleaf Onboarding Hub",
  description: "Manage job candidates through the Silverleaf Academy hiring pipeline.",
};
import { Link } from "@/i18n/navigation";
import { listCandidatesFiltered } from "@/lib/hiring/pipeline";
import {
  BOARD_COLUMNS,
  STAGE_LABELS,
  type Candidate,
  type CandidateStage,
} from "@/lib/hiring/types";
import styles from "@/components/admin/admin.module.css";

export const dynamic = "force-dynamic";

/** Kanban board — candidate pipeline (SILVERLEAF_HIRING parity). */
export default async function AdminHiringBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; stage?: string }>;
}) {
  await params;
  const { q, stage } = await searchParams;
  const t = await getTranslations("admin.hiring.board");

  let candidates: Candidate[] = [];
  let loadError: string | null = null;

  try {
    candidates = await listCandidatesFiltered({ q, stage });
  } catch (err) {
    loadError =
      err instanceof Error ? err.message : "Could not load candidates";
  }

  const byStage = BOARD_COLUMNS.reduce(
    (acc, colStage) => {
      acc[colStage] = candidates.filter((c) => c.stage === colStage);
      return acc;
    },
    {} as Record<CandidateStage, Candidate[]>,
  );

  const other = candidates.filter((c) => !BOARD_COLUMNS.includes(c.stage));

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>{t("heading")}</h1>
        <p>{t("description")}</p>
        <p className={styles.muted}>
          {t("applyLink")}{" "}
          <Link href="/apply" className={styles.link}>
            /apply
          </Link>
          {" · "}
          <Link href="/admin/hiring/candidates/new" className={styles.link}>
            {t("manualEntry")}
          </Link>
          {" · "}
          <Link href="/admin/hiring/import" className={styles.link}>
            {t("csvImport")}
          </Link>
          {" · "}
          <Link href="/admin/hiring/performance-tasks" className={styles.link}>
            Manage performance tasks
          </Link>
        </p>
      </div>

      {loadError ? (
        <p className={styles.error}>{loadError}</p>
      ) : (
        <>
          <HiringBoardToolbar q={q} stage={stage} />

          <p className={styles.muted}>
            {t("count", { count: candidates.length })}
            {q || (stage && stage !== "all") ? ` ${t("filtered")}` : ""}
          </p>

          <div className={styles.hiringPipelineScroll}>
          <div className={styles.hiringPipeline}>
            {BOARD_COLUMNS.map((colStage) => (
              <section key={colStage} className={styles.hiringColumn}>
                <h3>
                  {STAGE_LABELS[colStage]}
                  <span className={styles.hiringCount}>
                    {byStage[colStage].length}
                  </span>
                </h3>
                <ul className={styles.hiringCardList}>
                  {byStage[colStage].map((c) => (
                    <li key={c.id} className={styles.hiringCard}>
                      <Link
                        href={`/admin/hiring/candidates/${c.id}`}
                        className={styles.link}
                      >
                        <strong>{c.full_name}</strong>
                      </Link>
                      <p className={styles.hiringMeta}>{c.role_applied}</p>
                      <AdvanceButtons candidate={c} compact />
                    </li>
                  ))}
                  {byStage[colStage].length === 0 ? (
                    <li className={styles.muted}>{t("emptyColumn")}</li>
                  ) : null}
                </ul>
              </section>
            ))}
          </div>
          </div>

          {other.length > 0 ? (
            <section>
              <h2 className={styles.sectionHeading}>{t("otherStages")}</h2>
              <ul className={styles.tableList}>
                {other.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/admin/hiring/candidates/${c.id}`}
                      className={styles.link}
                    >
                      {c.full_name}
                    </Link>
                    <span className={styles.muted}>
                      {" "}
                      · {STAGE_LABELS[c.stage]}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
