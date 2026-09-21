import "server-only";

import { inArray } from "drizzle-orm";
import { after } from "next/server";

import { db } from "@/lib/db/client";
import {
  contentRepo,
  policyBriefingsRepo,
  slaBotRepo,
} from "@/lib/db/repositories";
import { materials } from "@/lib/db/schema";
import {
  extractPolicyDocumentText,
  readMaterialBytes,
} from "@/lib/policy-briefing-extract";
import { isExtractablePolicyFile } from "@/lib/policy-briefing-script";
import { getSectionGuidance } from "@/lib/onboarding-guidance";

const MAX_DOC_CHARS = 10_000;
const MAX_DOCS_TO_EXTRACT = 40;

type KnowledgeChunk = {
  sourceType: string;
  sourceId: string;
  title: string;
  body: string;
};

function clipDocumentText(text: string, max = MAX_DOC_CHARS): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max)}…`;
}

/**
 * Rebuild SLA-bot knowledge from the live content tree, guidance copy,
 * published policy briefing scripts, and extractable document text (PDF/DOCX).
 * Called after CMS changes so answers stay current.
 */
export async function syncSlaBotKnowledge(): Promise<number> {
  const tree = await contentRepo.getSectionsWithItems();
  const itemIds = tree.flatMap((s) => s.items.map((i) => i.id));
  const briefings =
    itemIds.length > 0
      ? await policyBriefingsRepo.listPublishedBriefingsForItems(itemIds)
      : [];
  const briefingByItem = new Map(
    briefings.map((b) => [b.sectionItemId, b.scriptEn]),
  );

  const materialRows =
    itemIds.length > 0
      ? await db
          .select()
          .from(materials)
          .where(inArray(materials.sectionItemId, itemIds))
      : [];

  const materialsByItem = new Map<string, typeof materialRows>();
  for (const row of materialRows) {
    if (!row.sectionItemId) continue;
    const bucket = materialsByItem.get(row.sectionItemId);
    if (bucket) bucket.push(row);
    else materialsByItem.set(row.sectionItemId, [row]);
  }

  const chunks: KnowledgeChunk[] = [
    {
      sourceType: "hub",
      sourceId: "overview",
      title: "Silverleaf Onboarding Hub overview",
      body: [
        "The Silverleaf Onboarding Hub helps new staff complete onboarding.",
        "Members sign in, work through sections, open materials, complete checkpoints, and digitally sign policies.",
        "SLA-bot answers questions about how to use the hub, what to do next, and how policies/sign-off work.",
        "For urgent safeguarding concerns, staff should follow Child Protection policy and campus leads — not rely only on chat.",
        "Tech issues can be escalated by SLA-bot to IT (it@silverleaf.co.tz) and Mourine (mourine@silverleaf.co.tz).",
        "Feedback and alarmed issues are stored for HR admins and emailed when SMTP is configured.",
      ].join(" "),
    },
  ];

  const extractJobs: {
    materialId: string;
    title: string;
    filename: string;
    contentType: string;
    storageKey: string;
    url: string;
  }[] = [];

  for (const section of tree) {
    if (!section.isPublished) continue;
    const guidance = getSectionGuidance(section.id, "en");
    chunks.push({
      sourceType: "section",
      sourceId: section.id,
      title: section.title_en,
      body: [
        `Section ${section.number}: ${section.title_en}.`,
        section.description_en ?? "",
        guidance
          ? `Purpose: ${guidance.purpose} Outcome: ${guidance.outcome} How to use: ${guidance.howToUse.join(" ")}`
          : "",
        `Published: ${section.isPublished ? "yes" : "no"}.`,
        `Learning items (${section.items.length}): ${section.items.map((i) => i.title_en).join("; ")}.`,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    for (const item of section.items) {
      const script = briefingByItem.get(item.id);
      const briefingText = script
        ? [
            `Published briefing: ${script.title}.`,
            script.intro,
            ...script.chapters.map((c) => `${c.heading}: ${c.body}`),
            script.close,
            script.nextStep,
          ].join(" ")
        : "";
      chunks.push({
        sourceType: "item",
        sourceId: item.id,
        title: `${section.title_en} — ${item.title_en}`,
        body: [
          `Learning item ${item.id} in section ${section.id} (${section.title_en}).`,
          item.note_en ?? "",
          `Type: ${item.type}.`,
          briefingText,
        ]
          .filter(Boolean)
          .join("\n"),
      });

      const itemMats = materialsByItem.get(item.id) ?? [];
      for (const mat of itemMats) {
        if (!isExtractablePolicyFile(mat.filename, mat.contentType)) continue;
        extractJobs.push({
          materialId: mat.id,
          title: `${item.title_en} — ${mat.filename}`,
          filename: mat.filename,
          contentType: mat.contentType,
          storageKey: mat.storageKey,
          url: mat.url,
        });
      }
    }
  }

  // Prefer policy documents first (titles often include Policy / Handbook / NDA).
  extractJobs.sort((a, b) => {
    const score = (t: string) =>
      /policy|handbook|nda|conduct|privacy|protection|uniform|cash/i.test(t)
        ? 0
        : 1;
    return score(a.title) - score(b.title);
  });

  const toExtract = extractJobs.slice(0, MAX_DOCS_TO_EXTRACT);
  for (const job of toExtract) {
    try {
      const bytes = await readMaterialBytes({
        storageKey: job.storageKey,
        url: job.url,
      });
      if (!bytes || bytes.length === 0) continue;
      const text = await extractPolicyDocumentText({
        bytes,
        filename: job.filename,
        contentType: job.contentType,
      });
      const clipped = clipDocumentText(text);
      if (clipped.length < 80) continue;
      chunks.push({
        sourceType: "document",
        sourceId: job.materialId,
        title: job.title,
        body: `Official document text for ${job.title}:\n${clipped}`,
      });
    } catch (err) {
      console.warn("[sla-bot] document extract skipped", job.filename, err);
    }
  }

  return slaBotRepo.replaceKnowledge(chunks, "learner");
}

export function scheduleSlaBotKnowledgeSync(): void {
  const run = () =>
    syncSlaBotKnowledge().catch((err: unknown) => {
      console.error("[sla-bot] knowledge sync failed", err);
    });
  try {
    after(run);
  } catch {
    void run();
  }
}
