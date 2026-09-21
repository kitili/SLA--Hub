import "server-only";

import { eq } from "drizzle-orm";

import { db } from "../client";
import { onboardingFeedback, type OnboardingFeedback } from "../schema";

export async function getFeedbackForMember(
  memberId: string,
): Promise<OnboardingFeedback | undefined> {
  const rows = await db
    .select()
    .from(onboardingFeedback)
    .where(eq(onboardingFeedback.memberId, memberId))
    .limit(1);
  return rows[0];
}

export async function upsertFeedback(input: {
  memberId: string;
  expectations: string | null;
  unclear: string | null;
  improvements: string | null;
}): Promise<OnboardingFeedback> {
  const now = new Date();
  const rows = await db
    .insert(onboardingFeedback)
    .values({
      memberId: input.memberId,
      expectations: input.expectations,
      unclear: input.unclear,
      improvements: input.improvements,
      submittedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: onboardingFeedback.memberId,
      set: {
        expectations: input.expectations,
        unclear: input.unclear,
        improvements: input.improvements,
        updatedAt: now,
      },
    })
    .returning();
  return rows[0]!;
}
