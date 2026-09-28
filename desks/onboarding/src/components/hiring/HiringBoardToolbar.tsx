"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { FormEvent } from "react";

import { STAGE_LABELS, type CandidateStage } from "@/lib/hiring/types";
import styles from "@/components/admin/admin.module.css";

const FILTER_STAGES: CandidateStage[] = [
  "incomplete_application",
  "new",
  "culture_video_requested",
  "culture_video_submitted",
  "performance_task_requested",
  "performance_task_submitted",
  "online_interview_requested",
  "in_person_interview_requested",
  "hired",
  "rejected",
];

export function HiringBoardToolbar({
  q,
  stage,
}: {
  q?: string;
  stage?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    const query = String(form.get("q") || "").trim();
    const stageFilter = String(form.get("stage") || "all");
    if (query) params.set("q", query);
    if (stageFilter && stageFilter !== "all") params.set("stage", stageFilter);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function clearFilters() {
    router.push(pathname);
  }

  return (
    <form onSubmit={onSubmit} className={styles.hiringToolbar}>
      <label className={styles.hiringToolbarField}>
        <span className={styles.muted}>Search</span>
        <input
          name="q"
          defaultValue={q || ""}
          placeholder="Name, email, or role"
          className={styles.input}
        />
      </label>
      <label className={styles.hiringToolbarField}>
        <span className={styles.muted}>Stage</span>
        <select name="stage" defaultValue={stage || "all"} className={styles.input}>
          <option value="all">All stages</option>
          {FILTER_STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.hiringToolbarActions}>
        <button type="submit" className={styles.submit}>
          Apply
        </button>
        {q || (stage && stage !== "all") ? (
          <button type="button" className={styles.linkButton} onClick={clearFilters}>
            Clear
          </button>
        ) : null}
      </div>
    </form>
  );
}
