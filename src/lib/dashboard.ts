import "server-only";

/**
 * Member dashboard summary — the single typed read model the dashboard page and
 * the section flow both build on.
 *
 * Composes the content tree (sections + items), the member's progress (reads +
 * passed checkpoints) and the onboarding clock into one immutable snapshot:
 *   - per-section completion (every section is open from the start — there is no
 *     sequential locking; `locked` is retained as an always-false field)
 *   - whether the final sign-off is unlocked (`signoffReady`), gated on the
 *     required sections only — see {@link REQUIRED_SECTION_IDS}
 *   - an overall percentage
 *   - the single "what's next" step (resume reading / take a quiz / all done)
 *   - 6-week pacing derived from `staff.started_at` (stamped on first view)
 *
 * Localisation: section titles/descriptions are resolved here via
 * `resolveLocalized` for the active locale, so the UI layer stays presentational.
 *
 * SECURITY/PURITY: read-only against the repositories plus the member queries
 * helper. No correct-answer data is ever touched.
 */
import { contentRepo, policySignaturesRepo, progressRepo } from "@/lib/db/repositories";
import { ensureStartedAt } from "@/lib/db/queries/member";
import { resolveLocalized } from "@/lib/i18n-content";
import { itemRequiresPolicySignature } from "@/lib/policy-briefings";
import { requiredSectionsComplete } from "@/lib/required-sections";
import type { Locale } from "@/i18n/routing";

/** Total weeks the onboarding is paced over (legacy: "complete within 6 weeks"). */
export const ONBOARDING_WEEKS = 6;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** Per-section roll-up as shown on the dashboard and used to gate the section page. */
export interface SectionSummary {
  id: string;
  number: number;
  /** Localised section title (EN fallback). */
  title: string;
  /** Localised section description, if any. */
  description: string | null;
  icon: string | null;
  itemsTotal: number;
  itemsDone: number;
  /** First incomplete item id (for resume deep-links), if any. */
  firstIncompleteItemId?: string | null;
  /** All items read AND the checkpoint passed. */
  quizPassed: boolean;
  /** True until every item is read (the quiz cannot be taken yet). */
  hasQuiz: boolean;
  /** Retained always-false field — sections are no longer sequentially locked. */
  locked: boolean;
  /** 0–100, counts each item + the checkpoint as equal steps. */
  pct: number;
}

/** The one call-to-action the member should act on next. */
export type NextStepKind = "resume-reading" | "take-quiz" | "start-section" | "done";

export interface NextStep {
  kind: NextStepKind;
  /** Target section id (undefined only when kind === "done"). */
  sectionId?: string;
  /** Section number for display. */
  sectionNumber?: number;
  /** Localised section title for display. */
  sectionTitle?: string;
  /** For "resume-reading": the first unread item id (anchor on the section page). */
  itemId?: string;
}

/** On-track vs behind, derived from elapsed time vs completion. NOT colour-only. */
export interface Pacing {
  /** Whole weeks since the onboarding clock started (clamped ≥ 0). */
  weeksElapsed: number;
  totalWeeks: number;
  /** Sections passed so far. */
  sectionsPassed: number;
  totalSections: number;
  /** Expected sections passed by now to stay on a 6-week finish. */
  expectedSectionsByNow: number;
  /** True when at/ahead of the expected pace. */
  onTrack: boolean;
  /** ISO date the clock started, for display. */
  startedAtISO: string;
}

export interface MemberDashboardSummary {
  memberName: string | null;
  sections: SectionSummary[];
  /** 0–100 across all sections (item + checkpoint steps). */
  overallPct: number;
  /** Learning items read + checkpoints passed (denominator: all steps). */
  stepsDone: number;
  totalSteps: number;
  sectionsPassed: number;
  totalSections: number;
  /** Whether the final sign-off is unlocked (required sections all passed). */
  signoffReady: boolean;
  nextStep: NextStep;
  pacing: Pacing;
}

/** Steps in a section = one per item, plus one for the checkpoint quiz. */
function sectionSteps(itemsTotal: number, itemsDone: number, quizPassed: boolean) {
  const totalSteps = itemsTotal + 1; // +1 for the checkpoint
  const doneSteps = itemsDone + (quizPassed ? 1 : 0);
  const pct = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;
  return { totalSteps, doneSteps, pct };
}

/**
 * Roll up item reads + checkpoint passes across all sections into one 0–100 %.
 * Exported for admin monitoring and tests.
 */
export function computeOverallProgress(sections: SectionSummary[]): {
  overallPct: number;
  stepsDone: number;
  totalSteps: number;
  sectionsPassed: number;
  totalSections: number;
} {
  let totalSteps = 0;
  let stepsDone = 0;
  for (const section of sections) {
    const { totalSteps: sectionTotal, doneSteps: sectionDone } = sectionSteps(
      section.itemsTotal,
      section.itemsDone,
      section.quizPassed,
    );
    totalSteps += sectionTotal;
    stepsDone += sectionDone;
  }
  const sectionsPassed = sections.filter((s) => s.quizPassed).length;
  const totalSections = sections.length;
  const overallPct =
    totalSteps > 0 ? Math.round((stepsDone / totalSteps) * 100) : 0;
  return { overallPct, stepsDone, totalSteps, sectionsPassed, totalSections };
}

/**
 * Build the full dashboard summary for a member in a given locale.
 *
 * Side effect (intentional, idempotent): stamps `staff.started_at = now()` on
 * first call when it is still null — this is the onboarding clock starting.
 */
export async function getMemberDashboard(
  member: { id: string; fullName: string | null },
  locale: Locale,
): Promise<MemberDashboardSummary> {
  const [tree, progress, startedAt] = await Promise.all([
    contentRepo.getSectionsWithItems(),
    progressRepo.getProgressForStaff(member.id),
    ensureStartedAt(member.id),
  ]);

  const readSet = new Set(progress.readItems);
  const passedSet = new Set(progress.passedCheckpoints);

  const policyItemIds = tree.flatMap((s) =>
    s.items
      .filter((it) => itemRequiresPolicySignature(it.id, s.id))
      .map((it) => it.id),
  );
  const policySignatures =
    policyItemIds.length > 0
      ? await policySignaturesRepo.listSignaturesForMemberItems(
          member.id,
          policyItemIds,
        )
      : [];
  const signedPolicySet = new Set(policySignatures.map((s) => s.itemId));

  const sections: SectionSummary[] = [];

  for (const section of tree) {
    const itemsTotal = section.items.length;
    const incompleteItems = section.items.filter((it) => {
      if (itemRequiresPolicySignature(it.id, section.id)) return !signedPolicySet.has(it.id);
      return !readSet.has(it.id);
    });
    const itemsDone = itemsTotal - incompleteItems.length;
    const firstIncompleteItemId = incompleteItems[0]?.id ?? null;
    const checkpointId = `section-${section.id}`;
    const quizPassed = passedSet.has(checkpointId);
    const { pct } = sectionSteps(itemsTotal, itemsDone, quizPassed);

    sections.push({
      id: section.id,
      number: section.number,
      title: resolveLocalized(section, "title", locale) ?? section.id,
      description: resolveLocalized(section, "description", locale) ?? null,
      icon: section.icon,
      itemsTotal,
      itemsDone,
      firstIncompleteItemId,
      quizPassed,
      hasQuiz: itemsTotal > 0 && itemsDone >= itemsTotal,
      // Every section is open from the start — no sequential locking.
      locked: false,
      pct,
    });
  }

  const { overallPct, stepsDone, totalSteps, sectionsPassed, totalSections } =
    computeOverallProgress(sections);
  const signoffReady = requiredSectionsComplete(passedSet);

  const nextStep = computeNextStep(sections);
  const pacing = computePacing(startedAt, sectionsPassed, totalSections);

  return {
    memberName: member.fullName,
    sections,
    overallPct,
    stepsDone,
    totalSteps,
    sectionsPassed,
    totalSections,
    signoffReady,
    nextStep,
    pacing,
  };
}

/**
 * The first actionable thing for the member, scanning sections in order:
 *   - skip already-passed sections
 *   - the first unlocked, unfinished section drives the CTA:
 *       has unread items → resume reading (anchor first unread item)
 *       all read         → take the checkpoint quiz
 *       (no items yet)   → start the section (materials pending)
 *   - if every section is passed → done
 */
export function computeNextStep(sections: SectionSummary[]): NextStep {
  for (const s of sections) {
    if (s.quizPassed) continue;
    if (s.locked) {
      // The earliest incomplete section is locked — there's nothing actionable
      // before it (this only happens if a prior section has no quiz to pass).
      break;
    }
    if (s.itemsTotal === 0) {
      return {
        kind: "start-section",
        sectionId: s.id,
        sectionNumber: s.number,
        sectionTitle: s.title,
      };
    }
    if (s.itemsDone < s.itemsTotal) {
      return {
        kind: "resume-reading",
        sectionId: s.id,
        sectionNumber: s.number,
        sectionTitle: s.title,
        itemId: s.firstIncompleteItemId ?? undefined,
      };
    }
    // All items complete but checkpoint not passed → take the quiz/declaration.
    return {
      kind: "take-quiz",
      sectionId: s.id,
      sectionNumber: s.number,
      sectionTitle: s.title,
      itemId: "checkpoint",
    };
  }
  return { kind: "done" };
}

/**
 * 6-week pacing. `expectedSectionsByNow` rises linearly so that all sections
 * are expected done by week {@link ONBOARDING_WEEKS}. On-track means the member
 * has passed at least that many sections.
 */
export function computePacing(
  startedAt: Date | null,
  sectionsPassed: number,
  totalSections: number,
  now: Date = new Date(),
): Pacing {
  const start = startedAt ?? now;
  const elapsedMs = Math.max(0, now.getTime() - start.getTime());
  const weeksElapsed = Math.floor(elapsedMs / MS_PER_WEEK);

  // Linear target: by week W, (W / 6) of the sections should be done.
  const fractionExpected = Math.min(1, weeksElapsed / ONBOARDING_WEEKS);
  const expectedSectionsByNow = Math.min(
    totalSections,
    Math.round(fractionExpected * totalSections),
  );

  const onTrack = sectionsPassed >= expectedSectionsByNow;

  return {
    weeksElapsed,
    totalWeeks: ONBOARDING_WEEKS,
    sectionsPassed,
    totalSections,
    expectedSectionsByNow,
    onTrack,
    startedAtISO: start.toISOString(),
  };
}
