/** Sections that use a declaration checkpoint instead of a quiz. */
export const DECLARATION_SECTION_IDS = new Set(["policies"]);

export function isDeclarationSection(sectionId: string): boolean {
  return DECLARATION_SECTION_IDS.has(sectionId);
}

export function declarationCheckpointId(sectionId: string): string {
  return `section-${sectionId}`;
}
