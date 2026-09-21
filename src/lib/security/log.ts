/**
 * Structured security events. Callers must not pass emails, tokens, passwords,
 * or other PII in `extra`.
 */
export function securityLog(
  event: string,
  extra?: Record<string, string | number | boolean | undefined>,
): void {
  const payload: Record<string, string | number | boolean> = { event };
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value === undefined) continue;
      payload[key] = value;
    }
  }
  console.info("[security]", payload);
}
