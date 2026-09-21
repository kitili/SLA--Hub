"use client";

/**
 * SectionCheckpoint — the gate at the bottom of a section.
 *
 * Renders:
 *   - a "complete" badge when the checkpoint is already passed,
 *   - a locked hint until every document is read,
 *   - a declaration form (policies) or quiz once reading is complete.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";

import CheckpointQuiz, {
  type QuizQuestionView,
  type QuizSubmitResult,
} from "./CheckpointQuiz";
import PoliciesDeclarationForm from "./section/PoliciesDeclarationForm";
import styles from "./SectionCheckpoint.module.css";

export type CheckpointKind = "quiz" | "declaration";

export interface SectionCheckpointProps {
  sectionId: string;
  sectionNumber: number;
  /** Whether all items in the section have been marked read. */
  itemsComplete: boolean;
  /** Whether this section has any items at all (gates the "coming soon" copy). */
  hasItems: boolean;
  checkpointKind: CheckpointKind;
  /** Localised quiz questions (no correct answers). Null → no quiz configured. */
  questions: QuizQuestionView[] | null;
  /** Whether the checkpoint has already been passed. */
  isPassed?: boolean;
  /** Submit answers for server-side grading. */
  onSubmit: (
    answers: { questionId: string; optionId: string }[],
  ) => Promise<QuizSubmitResult>;
  /** Called after a passing submission (parent can reveal the next-section CTA). */
  onPassed?: () => void;
}

export default function SectionCheckpoint({
  sectionId,
  sectionNumber,
  itemsComplete,
  hasItems,
  checkpointKind,
  questions,
  isPassed = false,
  onSubmit,
  onPassed,
}: SectionCheckpointProps) {
  const t = useTranslations("member");
  const tPolicies = useTranslations("policies");
  const [justPassed, setJustPassed] = useState(false);

  const hasQuiz = questions && questions.length > 0;
  const isDeclaration = checkpointKind === "declaration";

  // No checkpoint configured for this section.
  if (!isDeclaration && !hasQuiz) return null;

  if (isPassed || justPassed) {
    return (
      <div
        id="section-checkpoint"
        className={`${styles.sectionCheckpoint} ${styles.passed}`}
      >
        <span aria-hidden>🛡</span>
        <span>
          {isDeclaration ? t("quiz.declarationPassedShort") : t("quiz.passedShort")}
        </span>
      </div>
    );
  }

  if (!itemsComplete) {
    return (
      <div
        id="section-checkpoint"
        className={`${styles.sectionCheckpoint} ${styles.locked}`}
      >
        <span aria-hidden>🛡</span>
        <div>
          <strong>
            {isDeclaration
              ? tPolicies("declarationTitle")
              : t("quiz.checkpointLabel")}
          </strong>
          <p>
            {hasItems
              ? isDeclaration
                ? t("quiz.declarationLockedHint")
                : t("quiz.lockedHint")
              : t("section.noItemsBody")}
          </p>
        </div>
      </div>
    );
  }

  if (isDeclaration) {
    return (
      <div id="section-checkpoint" className={styles.sectionCheckpoint}>
        <PoliciesDeclarationForm
          sectionId={sectionId}
          onPassed={() => {
            setJustPassed(true);
            onPassed?.();
          }}
        />
      </div>
    );
  }

  return (
    <div id="section-checkpoint" className={styles.sectionCheckpoint}>
      <div className={styles.sectionCheckpointIntro}>
        <span aria-hidden>🛡</span>
        <div>
          <strong>{t("quiz.checkpointLabel")}</strong>
        </div>
      </div>

      <CheckpointQuiz
        sectionNumber={sectionNumber}
        questions={questions!}
        onSubmit={onSubmit}
        onPassed={() => {
          setJustPassed(true);
          onPassed?.();
        }}
      />
    </div>
  );
}
