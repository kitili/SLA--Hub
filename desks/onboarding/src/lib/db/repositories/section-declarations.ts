import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "../client";
import { sectionDeclarations, type SectionDeclaration } from "../schema";

export async function getDeclarationForMemberSection(
  memberId: string,
  sectionId: string,
): Promise<SectionDeclaration | undefined> {
  const rows = await db
    .select()
    .from(sectionDeclarations)
    .where(
      and(
        eq(sectionDeclarations.memberId, memberId),
        eq(sectionDeclarations.sectionId, sectionId),
      ),
    )
    .orderBy(desc(sectionDeclarations.declaredAt))
    .limit(1);
  return rows[0];
}

export async function recordDeclaration(input: {
  memberId: string;
  sectionId: string;
  acknowledgedText: string;
}): Promise<SectionDeclaration> {
  const rows = await db
    .insert(sectionDeclarations)
    .values({
      memberId: input.memberId,
      sectionId: input.sectionId,
      acknowledgedText: input.acknowledgedText,
    })
    .returning();
  return rows[0]!;
}
