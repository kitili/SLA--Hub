"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { feedbackRepo } from "@/lib/db/repositories";

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .transform((value) => (value.length === 0 ? null : value));

const feedbackSchema = z
  .object({
    expectations: optionalText,
    unclear: optionalText,
    improvements: optionalText,
  })
  .refine(
    (data) =>
      data.expectations !== null ||
      data.unclear !== null ||
      data.improvements !== null,
    { message: "at-least-one" },
  );

export interface FeedbackRecord {
  expectations: string | null;
  unclear: string | null;
  improvements: string | null;
  submittedAt: string;
}

export interface FeedbackStatusResult {
  submitted: boolean;
  feedback?: FeedbackRecord;
}

export interface SubmitFeedbackResult {
  ok: boolean;
  error?: "unauthenticated" | "empty" | "failed";
  feedback?: FeedbackRecord;
}

function toRecord(row: {
  expectations: string | null;
  unclear: string | null;
  improvements: string | null;
  submittedAt: Date;
  updatedAt: Date;
}): FeedbackRecord {
  return {
    expectations: row.expectations,
    unclear: row.unclear,
    improvements: row.improvements,
    submittedAt: row.updatedAt.toISOString(),
  };
}

export async function feedbackStatus(): Promise<FeedbackStatusResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { submitted: false };
  }

  const existing = await feedbackRepo.getFeedbackForMember(user.id);
  if (!existing) {
    return { submitted: false };
  }

  return {
    submitted: true,
    feedback: toRecord(existing),
  };
}

export async function submitFeedbackAction(input: {
  expectations: string;
  unclear: string;
  improvements: string;
}): Promise<SubmitFeedbackResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "unauthenticated" };
  }

  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "empty" };
  }

  try {
    const saved = await feedbackRepo.upsertFeedback({
      memberId: user.id,
      ...parsed.data,
    });
    revalidatePath("/feedback");
    revalidatePath("/");
    return { ok: true, feedback: toRecord(saved) };
  } catch {
    return { ok: false, error: "failed" };
  }
}
