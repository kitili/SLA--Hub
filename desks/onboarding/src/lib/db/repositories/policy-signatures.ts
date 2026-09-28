import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "../client";
import { policySignatures, type PolicySignature } from "../schema";

export async function getSignatureForMemberItem(
  memberId: string,
  itemId: string,
): Promise<PolicySignature | undefined> {
  const rows = await db
    .select()
    .from(policySignatures)
    .where(
      and(
        eq(policySignatures.memberId, memberId),
        eq(policySignatures.itemId, itemId),
      ),
    )
    .limit(1);
  return rows[0];
}

export async function listSignaturesForMemberItems(
  memberId: string,
  itemIds: string[],
): Promise<PolicySignature[]> {
  if (itemIds.length === 0) return [];
  return db
    .select()
    .from(policySignatures)
    .where(
      and(
        eq(policySignatures.memberId, memberId),
        inArray(policySignatures.itemId, itemIds),
      ),
    );
}

/**
 * Upsert a digital signature for one policy item. Re-signing refreshes the
 * name, acknowledgement text, and timestamp.
 */
export async function recordPolicySignature(input: {
  memberId: string;
  itemId: string;
  signedName: string;
  acknowledgedText: string;
}): Promise<PolicySignature> {
  const existing = await getSignatureForMemberItem(input.memberId, input.itemId);
  if (existing) {
    const rows = await db
      .update(policySignatures)
      .set({
        signedName: input.signedName,
        acknowledgedText: input.acknowledgedText,
        signedAt: new Date(),
      })
      .where(eq(policySignatures.id, existing.id))
      .returning();
    return rows[0]!;
  }

  const rows = await db
    .insert(policySignatures)
    .values({
      memberId: input.memberId,
      itemId: input.itemId,
      signedName: input.signedName,
      acknowledgedText: input.acknowledgedText,
    })
    .returning();
  return rows[0]!;
}
