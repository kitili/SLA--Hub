import "server-only";

import { after } from "next/server";
import { revalidatePath } from "next/cache";

import * as adminQueries from "@/lib/db/queries/admin";
import { policyBriefingsRepo } from "@/lib/db/repositories";
import type { Material, SectionItem } from "@/lib/db/schema";
import {
  extractPolicyDocumentText,
  hashPolicyText,
  readMaterialBytes,
} from "@/lib/policy-briefing-extract";
import { generateBriefingScript } from "@/lib/policy-briefing-generate";
import {
  isExtractablePolicyFile,
  isPolicySection,
} from "@/lib/policy-briefing-script";

const STALE_GENERATING_MS = 2 * 60 * 1000;

function revalidateBriefingSurfaces(sectionId: string): void {
  revalidatePath(`/admin/sections/${sectionId}`);
  revalidatePath("/admin/materials");
  revalidatePath(`/[locale]/section/${sectionId}`, "page");
  revalidatePath("/[locale]", "page");
}

export async function runPolicyBriefingGeneration(briefingId: string): Promise<void> {
  const row = await policyBriefingsRepo.getBriefingById(briefingId);
  if (!row) return;

  const item = await adminQueries.findSectionItem(row.sectionItemId);
  if (!item) {
    await policyBriefingsRepo.markBriefingFailed(briefingId, "Learning item not found.");
    return;
  }

  const material = row.sourceMaterialId
    ? await adminQueries.findMaterial(row.sourceMaterialId)
    : undefined;
  if (!material) {
    await policyBriefingsRepo.markBriefingFailed(
      briefingId,
      "Policy file not found.",
    );
    revalidateBriefingSurfaces(item.sectionId);
    return;
  }

  try {
    const bytes = await readMaterialBytes(material);
    if (!bytes) {
      throw new Error("Could not read the uploaded policy file.");
    }
    const text = await extractPolicyDocumentText({
      bytes,
      filename: material.filename,
      contentType: material.contentType,
    });
    const { script, generator } = await generateBriefingScript(item.title_en, text);
    await policyBriefingsRepo.markBriefingDraft({
      id: briefingId,
      script,
      sourceHash: hashPolicyText(text),
      generator,
    });
  } catch (err) {
    const message =
      err instanceof Error && err.message === "NO_TEXT"
        ? "Could not read enough text from this file to write a briefing."
        : err instanceof Error && err.message === "UNSUPPORTED_TYPE"
          ? "Briefings can be generated from PDF, Word, or text files."
          : err instanceof Error
            ? err.message
            : "Briefing generation failed.";
    await policyBriefingsRepo.markBriefingFailed(briefingId, message);
  }

  revalidateBriefingSurfaces(item.sectionId);
}

export function schedulePolicyBriefingGeneration(briefingId: string): void {
  const run = () =>
    runPolicyBriefingGeneration(briefingId).catch((err: unknown) => {
      console.error("[policy-briefing] background generate failed", err);
    });
  try {
    after(run);
  } catch {
    void run();
  }
}

export async function queueBriefingForMaterial(
  input: {
    material: Material;
    item: SectionItem;
    createdBy: string | null;
  },
  opts?: { background?: boolean },
): Promise<string | null> {
  const { material, item, createdBy } = input;
  if (!isPolicySection(item.sectionId)) return null;
  if (!isExtractablePolicyFile(material.filename, material.contentType)) {
    return null;
  }

  const latest = await policyBriefingsRepo.getLatestBriefingForItem(item.id);
  if (
    latest?.status === "generating" &&
    Date.now() - latest.createdAt.getTime() < STALE_GENERATING_MS
  ) {
    return latest.id;
  }

  const row = await policyBriefingsRepo.createGeneratingBriefing({
    sectionItemId: item.id,
    sourceMaterialId: material.id,
    sourceFilename: material.filename,
    createdBy,
  });
  if (opts?.background !== false) {
    schedulePolicyBriefingGeneration(row.id);
  }
  return row.id;
}

export async function queueBriefingForMaterialId(
  materialId: string,
  createdBy: string | null,
): Promise<string | null> {
  const material = await adminQueries.findMaterial(materialId);
  if (!material?.sectionItemId) return null;
  const item = await adminQueries.findSectionItem(material.sectionItemId);
  if (!item) return null;
  return queueBriefingForMaterial({ material, item, createdBy });
}

export async function queueBriefingForItem(
  itemId: string,
  createdBy: string | null,
  background = true,
): Promise<string | null> {
  const item = await adminQueries.findSectionItem(itemId);
  if (!item || !isPolicySection(item.sectionId)) return null;

  const withMats = await adminQueries.listSectionItemsWithMaterials(
    item.sectionId,
  );
  const row = withMats.find((entry) => entry.id === itemId);
  const material = row?.materials.find((m) =>
    isExtractablePolicyFile(m.filename, m.contentType),
  );
  if (!material) return null;
  return queueBriefingForMaterial({ material, item, createdBy }, { background });
}
