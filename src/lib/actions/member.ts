"use server";

/**
 * Member server actions — the ONLY mutation entry points for the member
 * experience (progress + quiz grading). Every action re-resolves the current
 * user server-side (never trusts a client-supplied member id).
 *
 * Sections are no longer sequentially locked: a member may read items and take
 * any section's checkpoint at any time. The only remaining quiz gate is that
 * every item in the section must be read before grading.
 *
 * Returns plain serialisable result objects (never throws across the boundary
 * for expected outcomes) so client components can render friendly states.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser, signIn, signOut } from "@/lib/auth";
import { getSession, writeSession } from "@/lib/auth/providers/email";
import {
  verifyEdAdminStaff,
  verifyEdAdminStaffByEmail,
} from "@/lib/auth/ed-admin";
import {
  getConfiguredAdminPassword,
  verifyAdminPassword,
} from "@/lib/auth/admin-passwords";
import {
  contentRepo,
  policySignaturesRepo,
  progressRepo,
  quizzesRepo,
  sectionDeclarationsRepo,
  staffRepo,
} from "@/lib/db/repositories";
import { itemRequiresPolicySignature } from "@/lib/policy-briefings";
import {
  declarationCheckpointId,
  isDeclarationSection,
} from "@/lib/section-declarations";
import { normalizeStaffEmail } from "@/lib/email";
import { secretsEqual } from "@/lib/security/secrets";
import { takeToken } from "@/lib/security/rate-limit";
import { securityLog } from "@/lib/security/log";
import { allowLocalAdminDirectoryFallback, isHrAdminEmail } from "@/lib/env";

// Boundary input schemas — bound every client-supplied string before it reaches
// the directory match loop / DB, so an oversized payload can't be used for DoS.
const signInSchema = z.object({
  email: z.string().max(254),
  staffId: z.string().max(64).optional(),
  adminPassword: z.string().max(128).optional(),
});
const itemIdSchema = z.string().max(50);
const acknowledgedTextSchema = z.string().trim().min(1).max(5000);
const signedNameSchema = z.string().trim().min(2).max(255);
const submitQuizSchema = z.object({
  quizId: z.string().max(100),
  answers: z
    .array(
      z
        .object({ questionId: z.string().max(50), optionId: z.string().max(50) })
        .strict(),
    )
    .max(200),
});

export interface SignInResult {
  ok: boolean;
  /**
   * - "not-registered" → email + Staff ID don't match an ed-admin account.
   * - "inactive"       → matched account is not Current / is disabled.
   * - "invalid-input"  → email or Staff ID was empty.
   * - "admin-password-required" → admin email needs the admin password/PIN.
   * - "admin-password-invalid"  → supplied admin password/PIN is wrong.
   * - "directory-unavailable" → ed-admin staff directory could not be reached.
   * - "failed"         → unexpected error during sign-in.
   */
  error?:
    | "not-registered"
    | "inactive"
    | "invalid-input"
    | "admin-password-required"
    | "admin-password-invalid"
    | "directory-unavailable"
    | "failed";
}

/**
 * Sign a staff member in by verifying their work email + ed-admin Staff ID
 * against the ed-admin directory. This is the SOLE sign-in gate: every user —
 * admins included — must be an active ed-admin staff member.
 *
 * Admin privilege (`/admin` access) is still granted to `HR_ADMIN_EMAILS`
 * addresses by the email provider, but only AFTER they pass this check — so an
 * admin email must ALSO be an active ed-admin staff member. The display name is
 * taken from ed-admin (not free-typed).
 */
export async function signInMemberAction(input: {
  email: string;
  staffId?: string;
  adminPassword?: string;
}): Promise<SignInResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid-input" };
  }
  const email = normalizeStaffEmail(parsed.data.email);
  const staffId = parsed.data.staffId?.trim() ?? "";
  const adminPassword = parsed.data.adminPassword ?? "";
  if (!email) {
    return { ok: false, error: "invalid-input" };
  }
  if (!takeToken(`signin:${email}`, 8, 15 * 60_000)) {
    securityLog("rate.limited", { bucket: "signin" });
    return { ok: false, error: "failed" };
  }

  try {
    const isAdminEmail = isHrAdminEmail(email);
    if (!isAdminEmail && !staffId) {
      return { ok: false, error: "invalid-input" };
    }
    const verdict = isAdminEmail
      ? await verifyAdminSignIn(email, adminPassword)
      : await verifyEdAdminStaff(email, staffId);

    if (!verdict.ok) {
      if (verdict.reason === "admin-password-required") {
        return { ok: false, error: "admin-password-required" };
      }
      if (verdict.reason === "admin-password-invalid") {
        return { ok: false, error: "admin-password-invalid" };
      }
      if (verdict.reason === "inactive") return { ok: false, error: "inactive" };
      if (verdict.reason === "api-error") {
        return { ok: false, error: "directory-unavailable" };
      }
      return { ok: false, error: "not-registered" };
    }

    await signIn(email, verdict.fullName || undefined, {
      jobTitle: verdict.jobTitle,
      edAdminStaffId: verdict.staffId,
    });
    return { ok: true };
  } catch (error) {
    console.error("[member/sign-in] unexpected sign-in failure", error);
    return { ok: false, error: "failed" };
  }
}

type AdminSignInVerification =
  | Awaited<ReturnType<typeof verifyEdAdminStaffByEmail>>
  | {
      ok: false;
      reason: "admin-password-required" | "admin-password-invalid";
    };

async function verifyAdminSignIn(
  email: string,
  adminPassword: string,
): Promise<AdminSignInVerification> {
  if (!adminPassword) return { ok: false, reason: "admin-password-required" };

  const existingStaff = await staffRepo.findStaffByEmail(email);
  const configured = getConfiguredAdminPassword(email);
  const passwordMatches = existingStaff?.adminPasswordHash
    ? verifyAdminPassword(adminPassword, existingStaff.adminPasswordHash)
    : Boolean(configured) && secretsEqual(adminPassword, configured!);

  if (!passwordMatches) {
    return { ok: false, reason: "admin-password-invalid" };
  }

  const verdict = await verifyEdAdminStaffByEmail(email);
  if (verdict.ok) return verdict;

  // Local/dev bootstrap: password-verified HR admins may sign in even when the
  // address is not yet present in the live ed-admin directory.
  if (
    allowLocalAdminDirectoryFallback() &&
    (verdict.reason === "not-found" || verdict.reason === "api-error")
  ) {
    return {
      ok: true,
      fullName: existingStaff?.fullName?.trim() || "HR Admin",
      staffId: existingStaff?.edAdminStaffId?.trim() || "local-admin",
      jobTitle: existingStaff?.jobTitle ?? "People Operations",
    };
  }

  return verdict;
}

/**
 * Sign the current member out and return them to the sign-in page.
 *
 * Clears the session cookie via the identity layer, then `redirect`s to
 * `/sign-in` — the locale middleware rewrites the bare path to the active
 * locale (`/en/sign-in`, `/sw/sign-in`), mirroring how `requireUser` sends
 * unauthenticated users there. Redirecting server-side (rather than from the
 * client) guarantees the navigation reflects the now-absent session.
 */
export async function signOutMemberAction(): Promise<void> {
  await signOut();
  redirect("/login");
}

/**
 * Slide the idle session window forward. Called from the client idle-guard
 * while the user is actively using the page (so a long-lived tab does not
 * expire underneath them). No-op when there is no valid session.
 */
export async function touchSessionAction(): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session) return { ok: false };
  await writeSession({
    staffId: session.staffId,
    isAdmin: session.isAdmin === true,
  });
  return { ok: true };
}

export interface MarkReadResult {
  ok: boolean;
  error?: "unauthenticated" | "locked" | "not-found" | "requires-signature";
  readItems?: string[];
  passedCheckpoints?: string[];
}

/**
 * Mark a section item as read for the current member.
 *
 * Enforces: authenticated and the item exists. Policy briefing items cannot be
 * marked done this way — they must be digitally signed via
 * {@link submitPolicySignatureAction}. Idempotent for non-policy items.
 */
export async function markItemReadAction(
  itemId: string,
): Promise<MarkReadResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const parsedItemId = itemIdSchema.safeParse(itemId);
  if (!parsedItemId.success) return { ok: false, error: "not-found" };
  const safeItemId = parsedItemId.data;

  const tree = await contentRepo.getSectionsWithItems();
  const owningSection = tree.find((s) =>
    s.items.some((it) => it.id === safeItemId),
  );
  if (!owningSection) return { ok: false, error: "not-found" };

  if (itemRequiresPolicySignature(safeItemId, owningSection.id)) {
    return { ok: false, error: "requires-signature" };
  }

  const progress = await progressRepo.markDocumentRead(user.id, safeItemId);

  // Refresh the section page and the dashboard (progress changed).
  revalidatePath(`/[locale]/section/${owningSection.id}`, "page");
  revalidatePath("/[locale]", "page");

  return {
    ok: true,
    readItems: progress.readItems,
    passedCheckpoints: progress.passedCheckpoints,
  };
}

/** A single submitted answer from the quiz form. */
export interface QuizAnswer {
  questionId: string;
  optionId: string;
}

export interface SubmitQuizResult {
  ok: boolean;
  error?: "unauthenticated" | "locked" | "incomplete" | "unknown-quiz";
  passed?: boolean;
  score?: number;
  total?: number;
  passThreshold?: number;
}

/**
 * Grade and record a checkpoint quiz attempt for the current member.
 *
 * Enforces: authenticated and all items in the section have been read (the quiz
 * only exists once reading is complete). Sections are not locked, so any
 * section's checkpoint may be attempted once its items are read.
 * Scoring is server-authoritative (the repository recomputes from the DB);
 * 100% is required to pass, and every attempt is recorded (unlimited retries).
 */
export async function submitQuizAction(
  quizId: string,
  answers: QuizAnswer[],
): Promise<SubmitQuizResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const parsedQuiz = submitQuizSchema.safeParse({ quizId, answers });
  if (!parsedQuiz.success) return { ok: false, error: "unknown-quiz" };
  const { quizId: safeQuizId, answers: safeAnswers } = parsedQuiz.data;

  // quizId is "section-<sectionId>".
  const sectionId = safeQuizId.replace(/^section-/, "");

  const [tree, progress] = await Promise.all([
    contentRepo.getSectionsWithItems(),
    progressRepo.getProgressForStaff(user.id),
  ]);
  const section = tree.find((s) => s.id === sectionId);
  if (!section) return { ok: false, error: "unknown-quiz" };

  // All items must be read before grading (the checkpoint gate).
  const readSet = new Set(progress.readItems);
  const allRead = section.items.every((it) => readSet.has(it.id));
  if (section.items.length > 0 && !allRead) {
    return { ok: false, error: "incomplete" };
  }

  let result;
  try {
    result = await quizzesRepo.gradeAndRecordAttempt({
      memberId: user.id,
      quizId: safeQuizId,
      answers: safeAnswers,
    });
  } catch {
    return { ok: false, error: "unknown-quiz" };
  }

  // Progress changed (and possibly an unlock) — refresh section + dashboard.
  revalidatePath(`/[locale]/section/${sectionId}`, "page");
  revalidatePath("/[locale]", "page");

  return {
    ok: true,
    passed: result.passed,
    score: result.score,
    total: result.total,
    passThreshold: result.passThreshold,
  };
}

export interface SubmitDeclarationResult {
  ok: boolean;
  error?:
    | "unauthenticated"
    | "incomplete"
    | "unsupported-section"
    | "failed";
}

/**
 * Record a section declaration checkpoint (e.g. policies) for the current member.
 *
 * Enforces: authenticated, section uses declaration flow, and all items read.
 * Marks `section-<sectionId>` in checkpoint_completions and stores the verbatim
 * declaration text for audit.
 */
export async function submitSectionDeclarationAction(
  sectionId: string,
  acknowledgedText: string,
): Promise<SubmitDeclarationResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const safeSectionId = z.string().max(50).safeParse(sectionId);
  if (!safeSectionId.success || !isDeclarationSection(safeSectionId.data)) {
    return { ok: false, error: "unsupported-section" };
  }

  const parsedText = acknowledgedTextSchema.safeParse(acknowledgedText);
  if (!parsedText.success) return { ok: false, error: "failed" };

  const [tree, progress] = await Promise.all([
    contentRepo.getSectionsWithItems(),
    progressRepo.getProgressForStaff(user.id),
  ]);
  const section = tree.find((s) => s.id === safeSectionId.data);
  if (!section) return { ok: false, error: "unsupported-section" };

  const readSet = new Set(progress.readItems);
  const allRead = section.items.every((it) => readSet.has(it.id));
  if (section.items.length > 0 && !allRead) {
    return { ok: false, error: "incomplete" };
  }

  // Every policy with a briefing must have a stored digital signature.
  const policyItemIds = section.items
    .filter((it) => itemRequiresPolicySignature(it.id, section.id))
    .map((it) => it.id);
  if (policyItemIds.length > 0) {
    const signatures =
      await policySignaturesRepo.listSignaturesForMemberItems(
        user.id,
        policyItemIds,
      );
    if (signatures.length < policyItemIds.length) {
      return { ok: false, error: "incomplete" };
    }
  }

  try {
    await sectionDeclarationsRepo.recordDeclaration({
      memberId: user.id,
      sectionId: safeSectionId.data,
      acknowledgedText: parsedText.data,
    });
    await progressRepo.markCheckpointPassed(
      user.id,
      declarationCheckpointId(safeSectionId.data),
    );
  } catch {
    return { ok: false, error: "failed" };
  }

  revalidatePath(`/[locale]/section/${safeSectionId.data}`, "page");
  revalidatePath("/[locale]", "page");

  return { ok: true };
}

export interface SubmitPolicySignatureResult {
  ok: boolean;
  error?:
    | "unauthenticated"
    | "invalid-input"
    | "not-found"
    | "unsupported-item"
    | "failed";
  readItems?: string[];
  signedName?: string;
  signedAtISO?: string;
}

/**
 * Digitally sign one policy learning item: typed full name + acknowledgement.
 * Also marks the item as read so section progress advances.
 */
export async function submitPolicySignatureAction(input: {
  itemId: string;
  signedName: string;
  acknowledgedText: string;
}): Promise<SubmitPolicySignatureResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const itemId = itemIdSchema.safeParse(input.itemId);
  const signedName = signedNameSchema.safeParse(input.signedName);
  const acknowledgedText = acknowledgedTextSchema.safeParse(
    input.acknowledgedText,
  );
  if (!itemId.success || !signedName.success || !acknowledgedText.success) {
    return { ok: false, error: "invalid-input" };
  }

  const tree = await contentRepo.getSectionsWithItems();
  const owningSection = tree.find((s) =>
    s.items.some((it) => it.id === itemId.data),
  );
  if (
    !owningSection ||
    !itemRequiresPolicySignature(itemId.data, owningSection.id)
  ) {
    return { ok: false, error: "unsupported-item" };
  }
  if (!isDeclarationSection(owningSection.id)) {
    return { ok: false, error: "not-found" };
  }

  try {
    const signature = await policySignaturesRepo.recordPolicySignature({
      memberId: user.id,
      itemId: itemId.data,
      signedName: signedName.data,
      acknowledgedText: acknowledgedText.data,
    });
    const progress = await progressRepo.markDocumentRead(
      user.id,
      itemId.data,
    );

    revalidatePath(`/[locale]/section/${owningSection.id}`, "page");
    revalidatePath("/[locale]", "page");

    return {
      ok: true,
      readItems: progress.readItems,
      signedName: signature.signedName,
      signedAtISO: signature.signedAt.toISOString(),
    };
  } catch {
    return { ok: false, error: "failed" };
  }
}
