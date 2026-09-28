const TOKEN_PREFIX = "OPS";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ParsedQrToken = {
  schoolId: string;
  studentId: string;
};

export function buildQrToken(schoolId: string, studentId: string): string {
  return `${TOKEN_PREFIX}|${schoolId}|${studentId}`;
}

export function parseQrToken(raw: string): ParsedQrToken | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith(`${TOKEN_PREFIX}|`)) return null;

  const parts = trimmed.split("|");
  if (parts.length !== 3) return null;

  const [, schoolId, studentId] = parts;
  if (!UUID_RE.test(schoolId) || !UUID_RE.test(studentId)) return null;

  return { schoolId, studentId };
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}
