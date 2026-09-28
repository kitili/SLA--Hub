const MIN_FILL_MS = 2_500;

/** Hidden honeypot fields must stay empty. */
export function honeypotTripped(value: string | undefined | null): boolean {
  return Boolean(value && value.trim().length > 0);
}

/** Reject submissions posted faster than a human can fill the form. */
export function submittedTooFast(
  formStartedAt: number | undefined,
  now = Date.now(),
): boolean {
  if (formStartedAt == null || !Number.isFinite(formStartedAt)) return false;
  return now - formStartedAt < MIN_FILL_MS;
}

/**
 * Verify a Cloudflare Turnstile token. When no secret is configured, skip
 * (so local/dev keep working). An empty token with a configured secret fails.
 */
export async function verifyTurnstile(
  token: string | undefined,
  secret: string | undefined,
  ip: string,
): Promise<boolean> {
  if (!secret) return true;
  if (!token) return false;

  try {
    const body = new URLSearchParams({
      secret,
      response: token,
      remoteip: ip,
    });
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!res.ok) return false;
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    return false;
  }
}
