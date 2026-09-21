/**
 * Per-policy briefing videos / scripts for Policies & Compliance items.
 *
 * Fallback MP4s live on Vercel Blob (`policy-briefings/{itemId}.mp4`) until an
 * admin publishes a generated briefing from the official PDF. The PDF remains
 * the authority.
 *
 * Local copies under `public/policy-briefings/` are kept for offline generation.
 */
import type { PolicyBriefingScript } from "@/lib/policy-briefing-script";
import { isPolicySection } from "@/lib/policy-briefing-script";

export type { PolicyBriefingScript };
export { POLICIES_SECTION_ID, isPolicySection } from "@/lib/policy-briefing-script";

export interface PolicyBriefing {
  itemId: string;
  title: string;
  /** Public path to the fallback briefing MP4, when no published script exists. */
  videoSrc?: string;
  /** One-line guidance under the player. */
  nextStep: string;
  /** Generated (and published) narration script — preferred over `videoSrc`. */
  script?: PolicyBriefingScript;
}

/** Items in the policies section require a digital signature. */
export function itemRequiresPolicySignature(
  itemId: string,
  sectionId: string,
): boolean {
  return isPolicySection(sectionId) || Boolean(POLICY_BRIEFINGS[itemId]);
}

/** Prefer a published generated script; otherwise the static MP4 map. */
export function resolveMemberBriefing(
  itemId: string,
  itemTitle: string,
  publishedScript: PolicyBriefingScript | null | undefined,
): PolicyBriefing | null {
  if (publishedScript && publishedScript.chapters.length > 0) {
    return {
      itemId,
      title: publishedScript.title || itemTitle,
      nextStep: publishedScript.nextStep,
      script: publishedScript,
    };
  }
  return getPolicyBriefing(itemId);
}

const BRIEFING_VIDEO_BASE =
  "https://uouuh48r3jvswj5i.public.blob.vercel-storage.com/policy-briefings";

export const POLICY_BRIEFINGS: Record<string, PolicyBriefing> = {
  "2-1": {
    itemId: "2-1",
    title: "Staff handbook",
    videoSrc: `${BRIEFING_VIDEO_BASE}/2-1.mp4`,
    nextStep: "Open the full Staff Handbook, then digitally sign this policy.",
  },
  "2-2": {
    itemId: "2-2",
    title: "HR policy manual",
    videoSrc: `${BRIEFING_VIDEO_BASE}/2-2.mp4`,
    nextStep: "Open the HR Policy Manual, then digitally sign this policy.",
  },
  "2-3": {
    itemId: "2-3",
    title: "Uniform policy",
    videoSrc: `${BRIEFING_VIDEO_BASE}/2-3.mp4`,
    nextStep: "Open the Uniform Policy, then digitally sign this policy.",
  },
  "2-4": {
    itemId: "2-4",
    title: "No cash policy",
    videoSrc: `${BRIEFING_VIDEO_BASE}/2-4.mp4`,
    nextStep: "Open the No Cash Policy, then digitally sign this policy.",
  },
  "2-5": {
    itemId: "2-5",
    title: "Child protection policy",
    videoSrc: `${BRIEFING_VIDEO_BASE}/2-5.mp4`,
    nextStep:
      "Open the Child Protection Policy carefully, then digitally sign it.",
  },
  "2-6": {
    itemId: "2-6",
    title: "ICT use policy (Tech Policy)",
    videoSrc: `${BRIEFING_VIDEO_BASE}/2-6.mp4`,
    nextStep: "Open the Tech Policy, then digitally sign this policy.",
  },
  "2-7": {
    itemId: "2-7",
    title: "Data privacy policy",
    videoSrc: `${BRIEFING_VIDEO_BASE}/2-7.mp4`,
    nextStep: "Open the Data Protection policy, then digitally sign it.",
  },
  "2-8": {
    itemId: "2-8",
    title: "Child Protection — Staff Code of Conduct",
    videoSrc: `${BRIEFING_VIDEO_BASE}/2-8.mp4`,
    nextStep: "Open the Staff Code of Conduct, then digitally sign it.",
  },
  "2-18": {
    itemId: "2-18",
    title: "Confidentiality / non-disclosure agreement",
    videoSrc: `${BRIEFING_VIDEO_BASE}/2-18.mp4`,
    nextStep:
      "Open the NDA, digitally sign it, then complete the section declaration.",
  },
};

export function getPolicyBriefing(itemId: string): PolicyBriefing | null {
  return POLICY_BRIEFINGS[itemId] ?? null;
}

export function listPolicyBriefings(): PolicyBriefing[] {
  return Object.values(POLICY_BRIEFINGS);
}
