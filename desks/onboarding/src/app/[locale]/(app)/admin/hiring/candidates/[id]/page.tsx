import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { AdvanceButtons } from "@/components/hiring/AdvanceButtons";
import { CandidateManagePanel } from "@/components/hiring/CandidateManagePanel";
import { HiringOnboardingPanel } from "@/components/hiring/HiringOnboardingPanel";
import { Link } from "@/i18n/navigation";
import { hiringFileHref } from "@/lib/hiring/file-links";
import { parseUuidParam } from "@/lib/hiring/ids";
import {
  getCandidateById,
  listPipelineEvents,
} from "@/lib/hiring/pipeline";
import { STAGE_LABELS } from "@/lib/hiring/types";
import styles from "@/components/admin/admin.module.css";

export const dynamic = "force-dynamic";

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id: rawId } = await params;
  const t = await getTranslations("admin.hiring.candidate");

  const id = parseUuidParam(rawId);
  if (!id) notFound();

  const candidate = await getCandidateById(id);
  if (!candidate) notFound();

  const events = await listPipelineEvents(id);

  return (
    <>
      <div className={styles.pageHeader}>
        <Link href="/admin/hiring" className={styles.link}>
          ← {t("backToBoard")}
        </Link>
        <h1>{candidate.full_name}</h1>
        <p className={styles.muted}>
          {candidate.role_applied} · {STAGE_LABELS[candidate.stage]}
        </p>
      </div>

      {candidate.stage === "hired" ? (
        <section className={styles.panel}>
          <HiringOnboardingPanel candidate={candidate} />
        </section>
      ) : (
        <section className={styles.panel}>
          <h2>{t("advanceHeading")}</h2>
          <AdvanceButtons candidate={candidate} />
        </section>
      )}

      <section className={styles.panel}>
        <CandidateManagePanel candidate={candidate} />
      </section>

      <section className={styles.panel}>
        <div className={styles.fieldRow}>
          <Field label={t("fields.email")} value={candidate.preferred_email || candidate.email} />
          <Field label={t("fields.applicationCheck")} value={candidate.application_check} />
          <Field label={t("fields.linkedin")} value={candidate.linkedin} href={candidate.linkedin} linkLabel="Open profile →" />
          <Field label={t("fields.cv")} value={candidate.cv_link} href={candidate.cv_link} linkLabel="Open CV →" />
          <Field label={t("fields.cultureMarker")} value={candidate.culture_marker || "—"} />
          <Field label={t("fields.performanceMarker")} value={candidate.performance_marker || "—"} />
          <Field label={t("fields.cultureVideo")} value={candidate.culture_video_link} href={candidate.culture_video_link ? hiringFileHref(candidate.culture_video_link) : null} linkLabel="Open video →" />
          <Field label={t("fields.performanceSubmission")} value={candidate.performance_task_submitted} href={candidate.performance_task_submitted ? hiringFileHref(candidate.performance_task_submitted) : null} linkLabel="Open submission →" />
          <Field label={t("fields.notes")} value={candidate.notes} />
        </div>
      </section>

      <section className={styles.panel}>
        <h2>{t("pipelineLog")}</h2>
        <ul className={styles.tableList}>
          {events.length === 0 ? (
            <li className={styles.muted}>{t("noEvents")}</li>
          ) : (
            events.map((ev) => (
              <li key={ev.id}>
                <strong>{ev.action}</strong>
                <span className={styles.muted}>
                  {" "}
                  ·{" "}
                  {new Date(ev.createdAt).toLocaleString("en-GB", {
                    timeZone: "Africa/Dar_es_Salaam",
                  })}
                </span>
                <p className={styles.muted}>
                  {ev.emailSubject || ev.detail || (ev.success ? "ok" : "failed")}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>
    </>
  );
}

function Field({
  label,
  value,
  href,
  linkLabel,
}: {
  label: string;
  value?: string | null;
  href?: string | null;
  linkLabel?: string;
}) {
  return (
    <div>
      <p className={styles.fieldLabel}>{label}</p>
      {href && value ? (
        <a href={href} target="_blank" rel="noreferrer" className={styles.fileButton}>
          {linkLabel ?? value}
        </a>
      ) : (
        <p>{value || "—"}</p>
      )}
    </div>
  );
}
