import "server-only";

/**
 * Signoff eligibility query — determines whether a member has passed the
 * checkpoints for the *required* sections (see {@link REQUIRED_SECTION_IDS}).
 *
 * Gating is by fixed section id, not display position, so reordering or
 * publishing changes in the admin CMS never alter what the sign-off requires.
 */
import { eq } from "drizzle-orm";

import { REQUIRED_SECTION_IDS } from "@/lib/required-sections";
import { db } from "../client";
import { checkpointCompletions } from "../schema";

export interface EligibilityResult {
  eligible: boolean;
  /** Number of required sections (constant). */
  totalSections: number;
  /** Number of required sections whose checkpoint the member has passed. */
  passedSections: number;
}

/**
 * Return whether `memberId` has passed the checkpoint for every required
 * section. The checkpoint id convention is `section-<sectionId>` (matching
 * the pattern used throughout the quiz/progress layer).
 */
export async function getMemberEligibility(
  memberId: string,
): Promise<EligibilityResult> {
  const completions = await db
    .select({ checkpointId: checkpointCompletions.checkpointId })
    .from(checkpointCompletions)
    .where(eq(checkpointCompletions.staffId, memberId));

  const passedSet = new Set(completions.map((c) => c.checkpointId));
  const totalSections = REQUIRED_SECTION_IDS.length;
  const passedSections = REQUIRED_SECTION_IDS.filter((id) =>
    passedSet.has(`section-${id}`),
  ).length;

  return {
    eligible: passedSections === totalSections,
    totalSections,
    passedSections,
  };
}
