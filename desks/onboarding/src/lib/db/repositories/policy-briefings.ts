import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "../client";
import {
  policyBriefings,
  type PolicyBriefingRow,
} from "../schema/policy-briefings";
import type { PolicyBriefingScript } from "@/lib/policy-briefing-script";

const EMPTY_SCRIPT: PolicyBriefingScript = {
  title: "",
  intro: "",
  chapters: [],
  close: "",
  nextStep: "",
};

export async function createGeneratingBriefing(input: {
  sectionItemId: string;
  sourceMaterialId: string | null;
  sourceFilename: string | null;
  createdBy: string | null;
}): Promise<PolicyBriefingRow> {
  const rows = await db
    .insert(policyBriefings)
    .values({
      sectionItemId: input.sectionItemId,
      sourceMaterialId: input.sourceMaterialId,
      sourceFilename: input.sourceFilename,
      status: "generating",
      scriptEn: EMPTY_SCRIPT,
      createdBy: input.createdBy,
    })
    .returning();
  return rows[0]!;
}

export async function getBriefingById(
  id: string,
): Promise<PolicyBriefingRow | undefined> {
  const rows = await db
    .select()
    .from(policyBriefings)
    .where(eq(policyBriefings.id, id))
    .limit(1);
  return rows[0];
}

export async function getLatestBriefingForItem(
  sectionItemId: string,
): Promise<PolicyBriefingRow | undefined> {
  const rows = await db
    .select()
    .from(policyBriefings)
    .where(eq(policyBriefings.sectionItemId, sectionItemId))
    .orderBy(desc(policyBriefings.createdAt))
    .limit(1);
  return rows[0];
}

export async function getPublishedBriefingForItem(
  sectionItemId: string,
): Promise<PolicyBriefingRow | undefined> {
  const rows = await db
    .select()
    .from(policyBriefings)
    .where(
      and(
        eq(policyBriefings.sectionItemId, sectionItemId),
        eq(policyBriefings.status, "published"),
      ),
    )
    .orderBy(desc(policyBriefings.publishedAt))
    .limit(1);
  return rows[0];
}

export async function listPublishedBriefingsForItems(
  sectionItemIds: string[],
): Promise<PolicyBriefingRow[]> {
  if (sectionItemIds.length === 0) return [];
  const rows = await db
    .select()
    .from(policyBriefings)
    .where(
      and(
        inArray(policyBriefings.sectionItemId, sectionItemIds),
        eq(policyBriefings.status, "published"),
      ),
    )
    .orderBy(desc(policyBriefings.publishedAt));

  const firstByItem = new Map<string, PolicyBriefingRow>();
  for (const row of rows) {
    if (!firstByItem.has(row.sectionItemId)) {
      firstByItem.set(row.sectionItemId, row);
    }
  }
  return [...firstByItem.values()];
}

export async function listLatestBriefingsForItems(
  sectionItemIds: string[],
): Promise<PolicyBriefingRow[]> {
  if (sectionItemIds.length === 0) return [];
  const rows = await db
    .select()
    .from(policyBriefings)
    .where(inArray(policyBriefings.sectionItemId, sectionItemIds))
    .orderBy(desc(policyBriefings.createdAt));

  const firstByItem = new Map<string, PolicyBriefingRow>();
  for (const row of rows) {
    if (!firstByItem.has(row.sectionItemId)) {
      firstByItem.set(row.sectionItemId, row);
    }
  }
  return [...firstByItem.values()];
}

export async function markBriefingDraft(input: {
  id: string;
  script: PolicyBriefingScript;
  sourceHash: string;
  generator: "openai" | "extractive";
}): Promise<PolicyBriefingRow | undefined> {
  const rows = await db
    .update(policyBriefings)
    .set({
      status: "draft",
      scriptEn: input.script,
      sourceHash: input.sourceHash,
      generator: input.generator,
      errorMessage: null,
    })
    .where(eq(policyBriefings.id, input.id))
    .returning();
  return rows[0];
}

export async function markBriefingFailed(
  id: string,
  errorMessage: string,
): Promise<void> {
  await db
    .update(policyBriefings)
    .set({
      status: "failed",
      errorMessage: errorMessage.slice(0, 1000),
    })
    .where(eq(policyBriefings.id, id));
}

export async function publishBriefing(id: string): Promise<PolicyBriefingRow | undefined> {
  const current = await getBriefingById(id);
  if (!current) return undefined;

  await db
    .update(policyBriefings)
    .set({ status: "draft", publishedAt: null })
    .where(
      and(
        eq(policyBriefings.sectionItemId, current.sectionItemId),
        eq(policyBriefings.status, "published"),
      ),
    );

  const rows = await db
    .update(policyBriefings)
    .set({
      status: "published",
      publishedAt: new Date(),
      errorMessage: null,
    })
    .where(eq(policyBriefings.id, id))
    .returning();
  return rows[0];
}
