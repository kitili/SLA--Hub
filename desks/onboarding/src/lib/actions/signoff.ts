"use server";

/**
 * Sign-off server action — the single mutation entry-point for the final
 * acknowledgement flow.
 *
 * Policy enforced here (not in the repo):
 *   1. Member must be authenticated.
 *   2. Member must be eligible (all published section checkpoints passed).
 *   3. Idempotent: if the member has already signed off, return their existing
 *      record rather than creating a duplicate.
 *   4. A current content version must exist; if none is seeded yet this
 *      returns an error (admin must seed one first).
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { signoffRepo } from "@/lib/db/repositories";
import { getMemberEligibility } from "@/lib/db/queries/signoff";

/** Bound the client-supplied acknowledgement text (stored as the audit record). */
const acknowledgedTextSchema = z.string().trim().min(1).max(5000);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SignoffStatus = "eligible" | "signed" | "not-eligible";

/** Serializable signoff shape safe for transport across the server action boundary. */
export interface SignoffRecord {
  id: string;
  /** ISO 8601 string — Date is serialized to string over the wire. */
  signedAt: string;
  acknowledgedText: string;
}

export interface SignoffStatusResult {
  status: SignoffStatus;
  /** Only present when status === "signed" */
  signoff?: SignoffRecord;
  totalSections?: number;
  passedSections?: number;
}

export interface SubmitSignoffResult {
  ok: boolean;
  error?:
    | "unauthenticated"
    | "not-eligible"
    | "no-content-version"
    | "failed";
  signoff?: SignoffRecord;
}

// ---------------------------------------------------------------------------
// Status helper (exported for dashboard wiring — does NOT modify state)
// ---------------------------------------------------------------------------

/**
 * Return the current sign-off status for the signed-in member.
 *
 * Resolves the member from the session (never from a caller-supplied id) so it
 * cannot be used to read another member's status — this is a `"use server"`
 * action and therefore an invocable endpoint. An unauthenticated caller gets a
 * benign empty result that leaks nothing.
 */
export async function signoffStatus(): Promise<SignoffStatusResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "not-eligible", totalSections: 0, passedSections: 0 };
  }
  const memberId = user.id;

  const [eligibility, existing] = await Promise.all([
    getMemberEligibility(memberId),
    signoffRepo.listSignoffsForMember(memberId),
  ]);

  const latestSignoff = existing[0];
  if (latestSignoff) {
    return {
      status: "signed",
      signoff: {
        id: latestSignoff.id,
        signedAt: latestSignoff.signedAt.toISOString(),
        acknowledgedText: latestSignoff.acknowledgedText,
      },
    };
  }

  if (eligibility.eligible) {
    return {
      status: "eligible",
      totalSections: eligibility.totalSections,
      passedSections: eligibility.passedSections,
    };
  }

  return {
    status: "not-eligible",
    totalSections: eligibility.totalSections,
    passedSections: eligibility.passedSections,
  };
}

// ---------------------------------------------------------------------------
// Submit action (called from the acknowledgement form)
// ---------------------------------------------------------------------------

/**
 * Record the current user's formal acknowledgement.
 *
 * Idempotent: if the user is already signed off, returns their existing record.
 * The acknowledged text is passed from the client so the server can store the
 * exact wording shown to the member at submission time (audit trail).
 */
export async function submitSignoffAction(
  acknowledgedText: string,
): Promise<SubmitSignoffResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  // Validate/bound the client-supplied audit text before persisting it.
  const parsedText = acknowledgedTextSchema.safeParse(acknowledgedText);
  if (!parsedText.success) return { ok: false, error: "failed" };

  // Idempotency check — return existing record if already signed.
  const existing = await signoffRepo.listSignoffsForMember(user.id);
  if (existing.length > 0) {
    const prev = existing[0]!;
    return {
      ok: true,
      signoff: {
        id: prev.id,
        signedAt: prev.signedAt.toISOString(),
        acknowledgedText: prev.acknowledgedText,
      },
    };
  }

  // Eligibility gate.
  const eligibility = await getMemberEligibility(user.id);
  if (!eligibility.eligible) {
    return { ok: false, error: "not-eligible" };
  }

  // Resolve the current content version.
  const contentVersion = await signoffRepo.getCurrentContentVersion();
  if (!contentVersion) {
    return { ok: false, error: "no-content-version" };
  }

  try {
    const signoff = await signoffRepo.createSignoff({
      memberId: user.id,
      contentVersionId: contentVersion.id,
      acknowledgedText: parsedText.data,
    });

    // Revalidate the sign-off page (and dashboard) so subsequent loads show
    // the completion state without a manual refresh.
    revalidatePath("/[locale]/sign-off", "page");
    revalidatePath("/[locale]", "page");

    return {
      ok: true,
      signoff: {
        id: signoff.id,
        signedAt: signoff.signedAt.toISOString(),
        acknowledgedText: signoff.acknowledgedText,
      },
    };
  } catch {
    return { ok: false, error: "failed" };
  }
}
