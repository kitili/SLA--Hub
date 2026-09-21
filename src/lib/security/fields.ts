/**
 * Allowlist a record so extra keys from a client payload cannot overwrite
 * privileged columns (stage, tokens, isAdmin, memberId, …).
 */
export function pickAllowedFields<T extends Record<string, unknown>>(
  input: T,
  allowed: readonly (keyof T)[],
): Partial<T> {
  const out: Partial<T> = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      out[key] = input[key];
    }
  }
  return out;
}

export function omitKeys<T extends Record<string, unknown>>(
  input: T,
  keys: readonly (keyof T)[],
): Omit<T, (typeof keys)[number]> {
  const drop = new Set<PropertyKey>(keys);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!drop.has(key)) out[key] = value;
  }
  return out as Omit<T, (typeof keys)[number]>;
}
