import "server-only";

/**
 * Sign-off repository — record formal acknowledgements against a content
 * version, and read the current (latest effective) version.
 *
 * Thin and typed; no policy here (deciding *when* a member may sign off lives in
 * a server action). A signoff captures the verbatim declaration text shown to
 * the member for audit.
 */
import { desc, eq } from "drizzle-orm";

import { db } from "../client";
import {
  contentVersions,
  signoffs,
  type ContentVersion,
  type Signoff,
} from "../schema";

/** The latest content version by `effective_at`, or `undefined` if none. */
export async function getCurrentContentVersion(): Promise<
  ContentVersion | undefined
> {
  const rows = await db
    .select()
    .from(contentVersions)
    .orderBy(desc(contentVersions.effectiveAt))
    .limit(1);
  return rows[0];
}

/** Record a member's acknowledgement of a content version. */
export async function createSignoff(input: {
  memberId: string;
  contentVersionId: string;
  acknowledgedText: string;
}): Promise<Signoff> {
  const rows = await db
    .insert(signoffs)
    .values({
      memberId: input.memberId,
      contentVersionId: input.contentVersionId,
      acknowledgedText: input.acknowledgedText,
    })
    .returning();
  return rows[0]!;
}

/** List a member's sign-offs, newest first. */
export async function listSignoffsForMember(
  memberId: string,
): Promise<Signoff[]> {
  return db
    .select()
    .from(signoffs)
    .where(eq(signoffs.memberId, memberId))
    .orderBy(desc(signoffs.signedAt));
}
