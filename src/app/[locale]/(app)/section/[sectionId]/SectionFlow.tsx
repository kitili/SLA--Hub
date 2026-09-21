"use client";

/**
 * SectionFlow — the interactive body of a section page.
 *
 * Holds the per-member read state and checkpoint-passed state on the client so
 * the UI reacts instantly, while every mutation is persisted through the member
 * server actions (which re-enforce auth + unlock + completion server-side, and
 * grade quizzes authoritatively).
 *
 * Reveal logic mirrors the legacy flow: the checkpoint quiz only appears once
 * every document in the section is marked done; passing it unlocks the next
 * section (the dashboard reflects this on next visit).
 */

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import DocumentCard, {
  type DocumentFileLink,
} from "@/components/DocumentCard";
import SectionCheckpoint from "@/components/SectionCheckpoint";
import type { QuizQuestionView } from "@/components/CheckpointQuiz";
import { markItemReadAction, submitQuizAction } from "@/lib/actions/member";
import {
  getPolicyBriefing,
  itemRequiresPolicySignature,
} from "@/lib/policy-briefings";
import { isDeclarationSection } from "@/lib/section-declarations";
import styles from "./section.module.css";

export interface SectionFlowItem {
  id: string;
  title: string;
  note?: string;
  type?: string;
  fileLinks: DocumentFileLink[];
  signature?: {
    signedName: string;
    signedAtISO: string;
  } | null;
  requiresSignature?: boolean;
  briefing?: ReturnType<typeof getPolicyBriefing>;
}

export interface SectionFlowProps {
  sectionId: string;
  sectionNumber: number;
  sectionTitle: string;
  quizId: string;
  items: SectionFlowItem[];
  questions: QuizQuestionView[] | null;
  /** Initial read item ids (from the DB). */
  initialReadIds: string[];
  /** Whether the checkpoint is already passed. */
  initialPassed: boolean;
  /** The next section's id, if any (for the "go to next section" CTA). */
  nextSectionId: string | null;
  /** Item id to scroll to on mount (resume), if provided. */
  resumeItemId?: string;
  /** Prefill typed digital signatures. */
  defaultSignedName?: string;
  /**
   * Policies section only: whether Welcome + Digital Tools (and any other
   * required sections besides policies) are already passed. Combined with the
   * policies checkpoint being passed, this unlocks final sign-off.
   */
  finalSignOffPrerequisitesMet?: boolean;
}

export default function SectionFlow({
  sectionId,
  sectionNumber,
  sectionTitle,
  quizId,
  items,
  questions,
  initialReadIds,
  initialPassed,
  nextSectionId,
  resumeItemId,
  defaultSignedName = "",
  finalSignOffPrerequisitesMet = false,
}: SectionFlowProps) {
  const t = useTranslations("member");
  const [readIds, setReadIds] = useState<Set<string>>(
    () => new Set(initialReadIds),
  );
  const [signatures, setSignatures] = useState<
    Record<string, { signedName: string; signedAtISO: string }>
  >(() => {
    const initial: Record<string, { signedName: string; signedAtISO: string }> =
      {};
    for (const item of items) {
      if (item.signature) initial[item.id] = item.signature;
    }
    return initial;
  });
  const [passed, setPassed] = useState(initialPassed);
  const [pendingItem, setPendingItem] = useState<string | null>(null);
  const [markError, setMarkError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (resumeItemId !== "checkpoint") return;
    requestAnimationFrame(() => {
      document
        .getElementById("section-checkpoint")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [resumeItemId]);

  const itemsComplete =
    items.length > 0 &&
    items.every((it) => {
      if (itemRequiresPolicySignature(it.id, sectionId) || it.requiresSignature) {
        return Boolean(signatures[it.id] ?? it.signature);
      }
      return readIds.has(it.id);
    });

  const handleMarkDone = (itemId: string) => {
    setPendingItem(itemId);
    setMarkError(null);
    startTransition(async () => {
      const res = await markItemReadAction(itemId);
      if (res.ok && res.readItems) {
        setReadIds(new Set(res.readItems));
      } else if (res.error === "requires-signature") {
        setMarkError(t("section.errorRequiresSignature"));
      } else {
        setMarkError(t("section.errorMarkDone"));
      }
      setPendingItem(null);
    });
  };

  const handlePolicySigned = (result: {
    itemId: string;
    readItems: string[];
    signedName: string;
    signedAtISO: string;
  }) => {
    setReadIds(new Set(result.readItems));
    setSignatures((prev) => ({
      ...prev,
      [result.itemId]: {
        signedName: result.signedName,
        signedAtISO: result.signedAtISO,
      },
    }));
  };

  const handleSubmitQuiz = async (
    answers: { questionId: string; optionId: string }[],
  ) => {
    const res = await submitQuizAction(quizId, answers);
    if (res.ok && res.passed) setPassed(true);
    return res;
  };

  const doneCount = items.filter((it) => {
    if (itemRequiresPolicySignature(it.id, sectionId) || it.requiresSignature) {
      return Boolean(signatures[it.id] ?? it.signature);
    }
    return readIds.has(it.id);
  }).length;

  const checkpointKind = isDeclarationSection(sectionId) ? "declaration" : "quiz";
  const canFinalSignOff =
    isDeclarationSection(sectionId) &&
    passed &&
    finalSignOffPrerequisitesMet;

  return (
    <div className={styles.flow}>
      <p className={styles.progressLine}>
        {t("section.progress", { done: doneCount, total: items.length })}
      </p>

      {markError && (
        <p className={styles.flowError} role="alert">
          {markError}
        </p>
      )}

      <div className={styles.cards}>
        {items.map((item, i) => (
          <DocumentCard
            key={item.id}
            item={{
              id: item.id,
              title: item.title,
              note: item.note,
              type: item.type,
            }}
            index={i + 1}
            fileLinks={item.fileLinks}
            isRead={readIds.has(item.id)}
            onMarkDone={handleMarkDone}
            pending={pendingItem === item.id}
            resumeItemId={resumeItemId}
            defaultSignedName={defaultSignedName}
            signature={signatures[item.id] ?? item.signature ?? null}
            onPolicySigned={handlePolicySigned}
            requiresSignature={
              item.requiresSignature ??
              itemRequiresPolicySignature(item.id, sectionId)
            }
            briefing={item.briefing ?? getPolicyBriefing(item.id)}
          />
        ))}
      </div>

      <SectionCheckpoint
        sectionId={sectionId}
        sectionNumber={sectionNumber}
        itemsComplete={itemsComplete}
        hasItems={items.length > 0}
        checkpointKind={checkpointKind}
        questions={questions}
        isPassed={passed}
        onSubmit={handleSubmitQuiz}
        onPassed={() => setPassed(true)}
      />

      {passed && isDeclarationSection(sectionId) && (
        <section
          className={styles.finalSignOff}
          aria-labelledby="final-signoff-heading"
        >
          <h2 id="final-signoff-heading">{t("dashboard.closingHeading")}</h2>
          <p className={styles.finalSignOffBody}>
            {canFinalSignOff
              ? t("section.finalSignOffReady")
              : t("section.finalSignOffLocked")}
          </p>
          {canFinalSignOff ? (
            <Link href="/sign-off" className={styles.nextSectionBtn}>
              {t("dashboard.journeySignoff")} →
            </Link>
          ) : (
            <span className={styles.finalSignOffDisabled} aria-disabled>
              <span aria-hidden>🔒</span> {t("dashboard.journeySignoffLocked")}
            </span>
          )}
        </section>
      )}

      {passed && (
        <div className={styles.afterPass}>
          {nextSectionId ? (
            <Link
              href={`/section/${nextSectionId}`}
              className={styles.nextSectionBtn}
            >
              {t("quiz.nextSection")} →
            </Link>
          ) : (
            <Link href="/" className={styles.nextSectionBtn}>
              {t("quiz.backToDashboard")} →
            </Link>
          )}
        </div>
      )}

      {/* Title is referenced for screen-reader context on the resume anchor. */}
      <span className={styles.srOnly}>{sectionTitle}</span>
      <span hidden>{sectionId}</span>
    </div>
  );
}
