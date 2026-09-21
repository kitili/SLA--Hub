/** Canonical UUID — reject crafted ids before they hit Postgres. */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseUuidParam(id: string | undefined | null): string | null {
  if (!id || !UUID_RE.test(id)) return null;
  return id;
}
