import { createClient } from "@/lib/supabase/server";

/** Resolve profile display names for audit UI ("Last edited by …"). */
export async function listProfileLabels(
  ids: Array<string | null | undefined>,
): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return {};

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", unique);
  if (error || !data) return {};

  const out: Record<string, string> = {};
  for (const row of data) {
    const name = (row.full_name as string | null)?.trim();
    out[row.id as string] = name || (row.id as string).slice(0, 8);
  }
  return out;
}
