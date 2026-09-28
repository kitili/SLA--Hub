/**
 * buildSearchText — single source of truth for the denormalised, lowercased
 * blob stored in `lesson_plans.search_text` (which backs the
 * `to_tsvector('simple', search_text)` GIN full-text index).
 *
 * Imports, seeds, and AI-generated plans all run their fields through this so
 * everything is searchable the same way. Pure function — safe to import from
 * scripts, server actions, and route handlers.
 */
export interface SearchTextParts {
  subject: string;
  grade: string;
  term: string;
  title: string;
  topic?: string | null;
  objectives?: string[] | null;
  contentMarkdown?: string | null;
}

export function buildSearchText(parts: SearchTextParts): string {
  return [
    parts.subject,
    parts.grade,
    parts.term,
    parts.title,
    parts.topic ?? "",
    (parts.objectives ?? []).join(" "),
    parts.contentMarkdown ?? "",
  ]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
