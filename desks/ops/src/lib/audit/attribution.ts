/** Shared audit / attribution helpers for "who last edited". */

export type AuditFields = {
  created_by?: string | null;
  created_at?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
};

export type ProfileLabel = {
  id: string;
  full_name: string | null;
};

/** Patch fields to include on every UPDATE (DB triggers also stamp these). */
export function auditUpdatePatch(userId: string | null | undefined): {
  updated_by: string | null;
  updated_at: string;
} {
  return {
    updated_by: userId ?? null,
    updated_at: new Date().toISOString(),
  };
}

export function formatPerson(
  id: string | null | undefined,
  labels?: Map<string, string> | Record<string, string> | null,
): string {
  if (!id) return "Unknown";
  if (labels instanceof Map) {
    return labels.get(id) ?? shortId(id);
  }
  if (labels && labels[id]) return labels[id];
  return shortId(id);
}

function shortId(id: string) {
  return id.slice(0, 8);
}

/** One-line UI copy: "Last edited by Kai · 19 Aug 2026, 04:40" */
export function formatLastEdited(
  row: AuditFields,
  labels?: Map<string, string> | Record<string, string> | null,
): string | null {
  const by = row.updated_by ?? null;
  const at = row.updated_at ?? null;
  if (!by && !at) return null;
  // Skip if never edited after create (same actor + same second is fine to hide).
  if (
    row.created_at &&
    at &&
    row.created_by &&
    by &&
    row.created_by === by &&
    Math.abs(new Date(at).getTime() - new Date(row.created_at).getTime()) < 2000
  ) {
    return null;
  }
  const who = formatPerson(by, labels);
  const when = at
    ? new Date(at).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  if (who && when) return `Last edited by ${who} · ${when}`;
  if (who) return `Last edited by ${who}`;
  if (when) return `Last edited · ${when}`;
  return null;
}
