const TOKEN_PREFIX = "GRD";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildGuardianQrToken(parentId: string): string {
  return `${TOKEN_PREFIX}|${parentId}`;
}

export function parseGuardianQrToken(raw: string): { parentId: string } | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith(`${TOKEN_PREFIX}|`)) return null;

  const parts = trimmed.split("|");
  if (parts.length !== 2) return null;

  const [, parentId] = parts;
  if (!UUID_RE.test(parentId)) return null;

  return { parentId };
}
